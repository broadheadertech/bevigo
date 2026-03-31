"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "pointerdown",
  "pointermove",
  "keydown",
  "scroll",
  "touchstart",
];

export function useIdleLock() {
  const [isLocked, setIsLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const { token } = useAuth();

  // Reactively read the tenant's configured idle timeout from Convex
  const settings = useQuery(
    api.settings.queries.getSettings,
    token ? { token } : "skip"
  );
  const lockSessionMutation = useMutation(api.auth.session.lockSession);

  const timeoutMs = Math.max(
    settings?.idleLockTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
    MIN_IDLE_TIMEOUT_MS
  );

  const lock = useCallback(async () => {
    setIsLocked(true);
    // Also mark the session as locked on the server
    if (token) {
      try {
        await lockSessionMutation({ token });
      } catch {
        // Session may already be expired; lock UI anyway
      }
    }
  }, [token, lockSessionMutation]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      lock();
    }, timeoutMs);
  }, [timeoutMs, lock]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    // Handler resets the idle timer on any user activity
    const handleActivity = () => {
      if (!isLocked) {
        resetTimer();
      }
    };

    // Attach listeners
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    // Start the initial timer
    resetTimer();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isLocked, resetTimer]);

  return { isLocked, lock, unlock, resetTimer };
}
