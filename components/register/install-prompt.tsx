"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = {
  canInstall: boolean;
  isStandalone: boolean;
  isDismissed: boolean;
};

const DISMISS_KEY = "bevigo-install-dismissed";

const defaultState: InstallState = {
  canInstall: false,
  isStandalone: false,
  isDismissed: false,
};

let sharedState: InstallState = { ...defaultState };
let deferredPrompt: BeforeInstallPromptEvent | null = null;
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

function getSnapshot(): InstallState {
  return sharedState;
}

function getServerSnapshot(): InstallState {
  return defaultState;
}

export function InstallPrompt() {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as unknown as { standalone: boolean }).standalone === true);

    const isDismissed = localStorage.getItem(DISMISS_KEY) === "true";

    sharedState = { ...sharedState, isStandalone, isDismissed };
    notify();

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      sharedState = { ...sharedState, canInstall: true };
      notify();
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      sharedState = { ...sharedState, canInstall: false, isStandalone: true };
      notify();
    }
    deferredPrompt = null;
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "true");
    sharedState = { ...sharedState, isDismissed: true };
    notify();
  }, []);

  // Don't show if already standalone, dismissed, or can't install
  if (state.isStandalone || state.isDismissed || !state.canInstall) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-medium text-amber-400">
        Install bevi&amp;go for the best experience
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDismiss}
          className="rounded-lg px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/15 transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={handleInstall}
          className="rounded-lg bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800 transition-colors"
        >
          Install
        </button>
      </div>
    </div>
  );
}
