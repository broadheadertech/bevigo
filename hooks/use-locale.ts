"use client";

import { useCallback, useSyncExternalStore } from "react";
import { t as translate, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "bevigo-locale";

function getServerSnapshot(): Locale {
  return "en";
}

function getSnapshot(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fil" || stored === "id") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "en";
}

function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handler);

  const customHandler = () => callback();
  window.addEventListener("locale-change", customHandler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("locale-change", customHandler);
  };
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem(STORAGE_KEY, newLocale);
    window.dispatchEvent(new Event("locale-change"));
  }, []);

  const t = useCallback(
    (key: string) => translate(key, locale),
    [locale]
  );

  return { locale, setLocale, t };
}
