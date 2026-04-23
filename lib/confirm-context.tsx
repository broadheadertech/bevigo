"use client";

import { createContext, ReactNode, useCallback, useContext, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button red instead of accent. */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

type ConfirmCtx = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmCtx | null>(null);

export function useConfirm(): ConfirmCtx {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmCtx>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const handleAnswer = (ok: boolean) => {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => handleAnswer(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-3">
              <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
                {pending.title ?? "Are you sure?"}
              </h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--muted-fg)" }}>
                {pending.message}
              </p>
            </div>
            <div
              className="px-6 py-4 flex justify-end gap-3"
              style={{ borderTop: "1px solid var(--border-color)" }}
            >
              <button
                onClick={() => handleAnswer(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => handleAnswer(true)}
                autoFocus
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={
                  pending.danger
                    ? { backgroundColor: "#dc2626" }
                    : { backgroundColor: "var(--accent-color)" }
                }
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
