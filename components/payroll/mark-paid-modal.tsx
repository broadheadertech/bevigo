"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type PaidVia = "cash" | "bank" | "gcash" | "maya" | "other";

const OPTIONS: { value: PaidVia; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "other", label: "Other" },
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type MarkPaidModalProps = {
  payslipId: Id<"payslips">;
  netPay: number;
  staffName: string;
  onClose: () => void;
};

export function MarkPaidModal({
  payslipId,
  netPay,
  staffName,
  onClose,
}: MarkPaidModalProps) {
  const { token } = useAuth();
  const markPaid = useMutation(api.payroll.mutations.markPayslipPaid);

  const [paidVia, setPaidVia] = useState<PaidVia>("cash");
  const [paidDate, setPaidDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const [y, m, d] = paidDate.split("-").map(Number);
      const paidAt = new Date(y, m - 1, d, 12, 0, 0).getTime();
      await markPaid({
        token,
        payslipId,
        paidVia,
        paidAt,
        paidNote: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark paid");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              Mark Paid
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              {staffName} &middot; {formatCurrency(netPay)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaidVia(opt.value)}
                  className="px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={
                    paidVia === opt.value
                      ? { backgroundColor: "var(--accent-color)", color: "white" }
                      : { backgroundColor: "var(--muted)", color: "var(--fg)" }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
              Date
            </label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full rounded-2xl px-3 py-3 text-sm"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-2xl px-3 py-3 text-sm"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              placeholder="e.g. Reference #, bank trace, etc."
            />
          </div>

          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Marking paid will automatically apply any loan repayment lines on this payslip to the staff's outstanding loan balance.
          </p>

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
            disabled={saving}
            className="px-5 py-2.5 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {saving ? "Saving..." : "Mark Paid"}
          </button>
        </div>
      </form>
    </div>
  );
}
