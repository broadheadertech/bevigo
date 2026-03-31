"use client";

import { useEffect, useCallback, useRef, useInsertionEffect } from "react";

export type ShortcutAction =
  | "focusSearch"
  | "completeOrder"
  | "voidOrder"
  | "cancelAction"
  | "selectCategory"
  | "increaseQuantity"
  | "decreaseQuantity"
  | null;

type ShortcutHandlers = {
  onFocusSearch?: () => void;
  onCompleteOrder?: () => void;
  onVoidOrder?: () => void;
  onCancelAction?: () => void;
  onSelectCategory?: (index: number) => void;
  onIncreaseQuantity?: () => void;
  onDecreaseQuantity?: () => void;
};

export function useRegisterShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  useInsertionEffect(() => {
    handlersRef.current = handlers;
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if a modal/overlay is open
    const overlay = document.querySelector("[data-overlay]");
    if (overlay) return;

    // Skip if user is typing in an input/textarea
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      if (e.key === "Escape") {
        (e.target as HTMLElement).blur();
      }
      return;
    }

    switch (e.key) {
      case "F1":
        e.preventDefault();
        handlersRef.current.onFocusSearch?.();
        break;
      case "F2":
        e.preventDefault();
        handlersRef.current.onCompleteOrder?.();
        break;
      case "F8":
        e.preventDefault();
        handlersRef.current.onVoidOrder?.();
        break;
      case "Escape":
        e.preventDefault();
        handlersRef.current.onCancelAction?.();
        break;
      case "+":
      case "=":
        e.preventDefault();
        handlersRef.current.onIncreaseQuantity?.();
        break;
      case "-":
        e.preventDefault();
        handlersRef.current.onDecreaseQuantity?.();
        break;
      default:
        if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          handlersRef.current.onSelectCategory?.(parseInt(e.key, 10) - 1);
        }
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
