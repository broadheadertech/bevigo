"use client";

import { useServiceWorker } from "@/hooks/use-service-worker";

export function SWRegister() {
  const { isUpdateAvailable } = useServiceWorker();

  // When a new shell is waiting, tell it to take over and reload so the
  // user gets the fresh UI on the next paint instead of having to manually
  // hard-refresh.
  if (typeof window !== "undefined" && isUpdateAvailable) {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage("SKIP_WAITING");
        // The 'controllerchange' event fires when the new SW activates;
        // reload once to pick it up.
        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloaded) return;
          reloaded = true;
          window.location.reload();
        });
      }
    });
  }

  return null;
}
