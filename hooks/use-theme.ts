"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "bevigo-theme";

function getServerSnapshot(): Theme {
  return "system";
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "system";
}

function subscribe(callback: () => void): () => void {
  // Apply theme on initial subscribe (first client render)
  applyTheme(getSnapshot());

  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  // Listen for cross-tab changes
  window.addEventListener("storage", handler);

  // Also listen for custom event for same-tab updates
  const customHandler = () => {
    applyTheme(getSnapshot());
    callback();
  };
  window.addEventListener("theme-change", customHandler);

  // Listen for system theme changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const mediaHandler = () => {
    applyTheme(getSnapshot());
    callback();
  };
  mediaQuery.addEventListener("change", mediaHandler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("theme-change", customHandler);
    mediaQuery.removeEventListener("change", mediaHandler);
  };
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolvedTheme = resolveTheme(theme);

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    window.dispatchEvent(new Event("theme-change"));
  }, []);

  return { theme, setTheme, resolvedTheme };
}
