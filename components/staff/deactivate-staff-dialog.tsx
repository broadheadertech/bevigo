"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type DeactivateStaffDialogProps = {
  staff: { _id: Id<"users">; name: string };
  onClose: () => void;
  onDone?: () => void;
};

export function DeactivateStaffDialog({
  staff,
  onClose,
  onDone,
}: DeactivateStaffDialogProps) {
  const { token } = useAuth();
  const setStatus = useMutation(api.staff.mutations.setStatus);

  const [clearPin, setClearPin] = useState(true);
  const [closeTimesheet, setCloseTimesheet] = useState(true);
  const [cancelLoans, setCancelLoans] = useState(false);
  const [invalidateSessions, setInvalidateSessions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await setStatus({
        token,
        userId: staff._id,
        status: "inactive",
        clearPin,
        closeActiveTimesheet: closeTimesheet,
        cancelActiveLoans: cancelLoans,
        invalidateSessions,
      });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        <div
          className="px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            Deactivate {staff.name}?
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>
            They will no longer be able to log in. All their past records (orders,
            timesheets, payslips) stay intact.
          </p>
        </div>

        <div className="p-6 space-y-3">
          <CheckOption
            label="Clear their Quick-PIN"
            hint="Stops them from punching in at the staff clock kiosk"
            checked={clearPin}
            onChange={setClearPin}
          />
          <CheckOption
            label="Close their open timesheet"
            hint="Auto-clocks out if they're currently on shift"
            checked={closeTimesheet}
            onChange={setCloseTimesheet}
          />
          <CheckOption
            label="Cancel their active loans"
            hint="Wipes remaining loan balance from payroll deductions. Past repayments stay recorded."
            checked={cancelLoans}
            onChange={setCancelLoans}
            warning
          />
          <CheckOption
            label="Log them out everywhere"
            hint="Invalidates all active sessions"
            checked={invalidateSessions}
            onChange={setInvalidateSessions}
          />

          {error && (
            <p className="text-sm text-center p-3 rounded-2xl bg-red-500/10 text-red-400">
              {error}
            </p>
          )}
        </div>

        <div
          className="px-6 py-4 flex justify-end gap-3"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="px-5 py-2.5 rounded-2xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckOption({
  label,
  hint,
  checked,
  onChange,
  warning,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warning?: boolean;
}) {
  return (
    <label className="flex gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-amber-500 shrink-0"
      />
      <div>
        <p className={`text-sm font-medium ${warning ? "text-amber-400" : ""}`} style={!warning ? { color: "var(--fg)" } : undefined}>
          {label}
        </p>
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          {hint}
        </p>
      </div>
    </label>
  );
}
