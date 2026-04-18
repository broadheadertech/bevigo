"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";

type NewPeriodModalProps = {
  onClose: () => void;
  onCreated: (periodId: string) => void;
};

function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function endOfDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function defaultLabel(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "";
  const [y1, m1, d1] = startIso.split("-").map(Number);
  const [y2, m2, d2] = endIso.split("-").map(Number);
  const monthName = (m: number) =>
    new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "short" });
  if (y1 === y2 && m1 === m2) {
    return `${monthName(m1)} ${d1}-${d2}, ${y1}`;
  }
  return `${monthName(m1)} ${d1}, ${y1} – ${monthName(m2)} ${d2}, ${y2}`;
}

export function NewPeriodModal({ onClose, onCreated }: NewPeriodModalProps) {
  const { token } = useAuth();
  const createPeriod = useMutation(api.payroll.mutations.createPeriod);

  const today = new Date();
  const defaultStart = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return formatDateInput(d);
  }, []);
  const defaultEnd = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 15);
    return formatDateInput(d);
  }, []);

  const [startIso, setStartIso] = useState(defaultStart);
  const [endIso, setEndIso] = useState(defaultEnd);
  const [label, setLabel] = useState(defaultLabel(defaultStart, defaultEnd));
  const [labelEdited, setLabelEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = (v: string) => {
    setStartIso(v);
    if (!labelEdited) setLabel(defaultLabel(v, endIso));
  };
  const handleEnd = (v: string) => {
    setEndIso(v);
    if (!labelEdited) setLabel(defaultLabel(startIso, v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!label.trim()) {
      setError("Label is required");
      return;
    }
    if (!startIso || !endIso) {
      setError("Start and end dates are required");
      return;
    }
    const start = startOfDay(startIso);
    const end = endOfDay(endIso);
    if (end < start) {
      setError("End date must be on or after start date");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createPeriod({
        token,
        label: label.trim(),
        startDate: start,
        endDate: end,
      });
      onCreated(res.periodId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create period");
      setIsSubmitting(false);
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
          <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            New Pay Period
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                Start
              </label>
              <input
                type="date"
                value={startIso}
                onChange={(e) => handleStart(e.target.value)}
                className="w-full rounded-2xl px-3 py-3 text-sm"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                End
              </label>
              <input
                type="date"
                value={endIso}
                onChange={(e) => handleEnd(e.target.value)}
                className="w-full rounded-2xl px-3 py-3 text-sm"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setLabelEdited(true);
              }}
              className="w-full rounded-2xl px-3 py-3 text-sm"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              placeholder="e.g. May 1-15, 2026"
              required
            />
          </div>

          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Draft payslips will be generated from completed timesheets in this range. Recurring deductions and active loan repayments will be auto-applied.
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
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {isSubmitting ? "Generating..." : "Create Period"}
          </button>
        </div>
      </form>
    </div>
  );
}
