"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSyncExternalStore } from "react";

type SWState = {
  isInstalled: boolean;
  isUpdateAvailable: boolean;
};

const defaultState: SWState = { isInstalled: false, isUpdateAvailable: false };

let sharedState: SWState = { ...defaultState };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l: () => void) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): SWState {
  return sharedState;
}

function getServerSnapshot(): SWState {
  return defaultState;
}

export function useServiceWorker() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration: ServiceWorkerRegistration) => {
        registrationRef.current = registration;

        if (registration.active) {
          sharedState = { ...sharedState, isInstalled: true };
          notify();
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                sharedState = { ...sharedState, isInstalled: true };
                notify();
              }
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                sharedState = { ...sharedState, isUpdateAvailable: true };
                notify();
              }
            });
          }
        });
      })
      .catch((error: Error) => {
        console.warn("Service worker registration failed:", error.message);
      });
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback(() => {
    if (registrationRef.current) {
      registrationRef.current.update();
    }
  }, []);

  return { ...state, update };
}
