"use client";

import { useEffect, useRef } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay to ensure the modal is rendered before focusing
      const timer = setTimeout(() => confirmRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--fg)" }}>
          {title}
        </h3>
        <p className="text-sm mb-6" style={{ color: "var(--muted-fg)" }}>
          {message}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            {cancelLabel || "Cancel"}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors"
            style={{ backgroundColor: variant === "danger" ? "#ef4444" : "var(--accent-color)" }}
          >
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
