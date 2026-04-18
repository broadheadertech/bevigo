"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type Line = { label: string; amount: string; loanId?: Id<"staffLoans"> };

type PayslipDetail = {
  _id: Id<"payslips">;
  userName: string;
  grossPay: number;
  currency: string;
  allowances: { label: string; amount: number }[];
  deductions: { label: string; amount: number; loanId?: Id<"staffLoans"> }[];
  notes?: string;
};

type EditPayslipModalProps = {
  payslipId: Id<"payslips">;
  onClose: () => void;
};

function toLines(input: { label: string; amount: number; loanId?: Id<"staffLoans"> }[]): Line[] {
  return input.map((l) => ({
    label: l.label,
    amount: (l.amount / 100).toFixed(2),
    loanId: l.loanId,
  }));
}

export function EditPayslipModal({ payslipId, onClose }: EditPayslipModalProps) {
  const { token } = useAuth();
  const data = useQuery(
    api.payroll.queries.getPayslipDetail,
    token ? { token, payslipId } : "skip"
  ) as PayslipDetail | undefined;

  const updateLines = useMutation(api.payroll.mutations.updatePayslipLines);

  const [allowances, setAllowances] = useState<Line[]>([]);
  const [deductions, setDeductions] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !hydrated) {
      setAllowances(toLines(data.allowances));
      setDeductions(toLines(data.deductions));
      setNotes(data.notes ?? "");
      setHydrated(true);
    }
  }, [data, hydrated]);

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
        >
          <p style={{ color: "var(--muted-fg)" }}>Loading payslip...</p>
        </div>
      </div>
    );
  }

  const totalAllow = allowances.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalDed = deductions.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const net = data.grossPay / 100 + totalAllow - totalDed;

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateLines({
        token,
        payslipId,
        allowances: allowances.map((l) => ({
          label: l.label,
          amount: Math.round((parseFloat(l.amount) || 0) * 100),
        })),
        deductions: deductions.map((l) => ({
          label: l.label,
          amount: Math.round((parseFloat(l.amount) || 0) * 100),
          loanId: l.loanId,
        })),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-auto">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              Edit Payslip
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              {data.userName} &middot; gross {formatCurrency(data.grossPay, data.currency)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        <div className="p-6 space-y-6">
          <LineEditor
            title="Allowances"
            sign="+"
            lines={allowances}
            onChange={setAllowances}
            placeholderLabel="Transport, Bonus, etc."
          />
          <LineEditor
            title="Deductions"
            sign="−"
            lines={deductions}
            onChange={setDeductions}
            placeholderLabel="SSS, Cash advance, etc."
            note="Loan repayment lines (auto-added) shouldn't be removed unless you also adjust the loan record."
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-2xl px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              placeholder="Anything to record on the payslip"
            />
          </div>

          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{ backgroundColor: "var(--muted)" }}
          >
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--muted-fg)" }}>
                Net Pay
              </p>
              <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                Gross + allowances − deductions
              </p>
            </div>
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(Math.round(net * 100), data.currency)}
            </p>
          </div>

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
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineEditor({
  title,
  sign,
  lines,
  onChange,
  placeholderLabel,
  note,
}: {
  title: string;
  sign: "+" | "−";
  lines: Line[];
  onChange: (l: Line[]) => void;
  placeholderLabel: string;
  note?: string;
}) {
  const updateLabel = (i: number, value: string) => {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, label: value } : l)));
  };
  const updateAmount = (i: number, value: string) => {
    onChange(
      lines.map((l, idx) =>
        idx === i ? { ...l, amount: value.replace(/[^0-9.]/g, "") } : l
      )
    );
  };
  const remove = (i: number) => {
    onChange(lines.filter((_, idx) => idx !== i));
  };
  const add = () => {
    onChange([...lines, { label: "", amount: "" }]);
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
        {title}
      </p>
      <div className="space-y-2">
        {lines.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>None</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-center" style={{ color: "var(--muted-fg)" }}>
              {sign}
            </span>
            <input
              type="text"
              value={line.label}
              onChange={(e) => updateLabel(i, e.target.value)}
              className="flex-1 rounded-2xl px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              placeholder={placeholderLabel}
            />
            <input
              type="text"
              inputMode="decimal"
              value={line.amount}
              onChange={(e) => updateAmount(i, e.target.value)}
              className="w-28 rounded-2xl px-3 py-2 text-sm text-right font-mono"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              placeholder="0.00"
            />
            {line.loanId && (
              <span
                className="text-[10px] px-2 py-1 rounded-full"
                style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}
                title="Loan repayment line — applied to the loan when paid"
              >
                LOAN
              </span>
            )}
            <button
              onClick={() => remove(i)}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-red-400"
            >
              &#10005;
            </button>
          </div>
        ))}
        <button
          onClick={add}
          className="w-full py-2 rounded-2xl text-xs font-medium border border-dashed"
          style={{ borderColor: "var(--border-color)", color: "var(--muted-fg)" }}
        >
          + Add line
        </button>
      </div>
      {note && (
        <p className="text-xs mt-2" style={{ color: "var(--muted-fg)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
