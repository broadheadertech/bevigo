"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type Deduction = {
  _id: Id<"staffRecurringDeductions">;
  label: string;
  amount: number;
  active: boolean;
};

type Loan = {
  _id: Id<"staffLoans">;
  principal: number;
  balanceRemaining: number;
  perPeriodDeduction: number;
  status: "active" | "paid_off" | "cancelled";
  notes?: string;
  issuedAt: number;
  completedAt?: number;
};

type Data = { deductions: Deduction[]; loans: Loan[] };

type StaffFinancePanelProps = {
  userId: Id<"users">;
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StaffFinancePanel({ userId }: StaffFinancePanelProps) {
  const { token } = useAuth();
  const data = useQuery(
    api.staffFinance.queries.listForUser,
    token ? { token, userId } : "skip"
  ) as Data | undefined;

  const addDeduction = useMutation(
    api.staffFinance.mutations.addRecurringDeduction
  );
  const updateDeduction = useMutation(
    api.staffFinance.mutations.updateRecurringDeduction
  );
  const removeDeduction = useMutation(
    api.staffFinance.mutations.removeRecurringDeduction
  );
  const issueLoan = useMutation(api.staffFinance.mutations.issueLoan);
  const updateLoan = useMutation(api.staffFinance.mutations.updateLoan);

  const [showAddDed, setShowAddDed] = useState(false);
  const [newDedLabel, setNewDedLabel] = useState("");
  const [newDedAmount, setNewDedAmount] = useState("");

  const [showAddLoan, setShowAddLoan] = useState(false);
  const [newLoanPrincipal, setNewLoanPrincipal] = useState("");
  const [newLoanPerPeriod, setNewLoanPerPeriod] = useState("");
  const [newLoanNotes, setNewLoanNotes] = useState("");

  const [confirmRemoveDed, setConfirmRemoveDed] = useState<Id<"staffRecurringDeductions"> | null>(null);
  const [confirmCancelLoan, setConfirmCancelLoan] = useState<Id<"staffLoans"> | null>(null);

  if (!token) return null;

  const handleAddDeduction = async () => {
    if (!newDedLabel.trim() || !newDedAmount) return;
    const amount = Math.round((parseFloat(newDedAmount) || 0) * 100);
    if (amount <= 0) return;
    await addDeduction({ token, userId, label: newDedLabel.trim(), amount });
    setNewDedLabel("");
    setNewDedAmount("");
    setShowAddDed(false);
  };

  const handleAddLoan = async () => {
    const principal = Math.round((parseFloat(newLoanPrincipal) || 0) * 100);
    const perPeriod = Math.round((parseFloat(newLoanPerPeriod) || 0) * 100);
    if (principal <= 0 || perPeriod <= 0 || perPeriod > principal) return;
    await issueLoan({
      token,
      userId,
      principal,
      perPeriodDeduction: perPeriod,
      notes: newLoanNotes.trim() || undefined,
    });
    setNewLoanPrincipal("");
    setNewLoanPerPeriod("");
    setNewLoanNotes("");
    setShowAddLoan(false);
  };

  const activeLoans = (data?.loans ?? []).filter((l) => l.status === "active");
  const otherLoans = (data?.loans ?? []).filter((l) => l.status !== "active");

  return (
    <div
      className="rounded-2xl p-4 space-y-5"
      style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}
    >
      {/* Recurring Deductions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
            Recurring Deductions
          </p>
          <button
            type="button"
            onClick={() => setShowAddDed((v) => !v)}
            className="text-xs font-medium"
            style={{ color: "var(--accent-color)" }}
          >
            {showAddDed ? "Cancel" : "+ Add"}
          </button>
        </div>

        {data === undefined ? (
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>Loading...</p>
        ) : data.deductions.length === 0 && !showAddDed ? (
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            None. Common examples: SSS, PhilHealth, Pag-IBIG, BIR.
          </p>
        ) : (
          <div className="space-y-1.5">
            {data.deductions.map((d) => (
              <div
                key={d._id}
                className="flex items-center gap-2 text-sm"
                style={{ opacity: d.active ? 1 : 0.5 }}
              >
                <span className="flex-1" style={{ color: "var(--fg)" }}>
                  {d.label}
                </span>
                <span className="font-mono">{formatCurrency(d.amount)}</span>
                <button
                  type="button"
                  onClick={() =>
                    updateDeduction({
                      token,
                      deductionId: d._id,
                      active: !d.active,
                    })
                  }
                  className="text-xs"
                  style={{ color: "var(--muted-fg)" }}
                >
                  {d.active ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemoveDed(d._id)}
                  className="text-xs text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {showAddDed && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={newDedLabel}
              onChange={(e) => setNewDedLabel(e.target.value)}
              placeholder="Label (e.g. SSS)"
              className="flex-1 rounded-xl px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            />
            <input
              type="text"
              inputMode="decimal"
              value={newDedAmount}
              onChange={(e) => setNewDedAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="w-24 rounded-xl px-3 py-2 text-sm text-right font-mono"
              style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            />
            <button
              type="button"
              onClick={handleAddDeduction}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Active Loans */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
            In-house Loans
          </p>
          <button
            type="button"
            onClick={() => setShowAddLoan((v) => !v)}
            className="text-xs font-medium"
            style={{ color: "var(--accent-color)" }}
          >
            {showAddLoan ? "Cancel" : "+ Issue Loan"}
          </button>
        </div>

        {data === undefined ? (
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>Loading...</p>
        ) : activeLoans.length === 0 && !showAddLoan ? (
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            No active loans.
          </p>
        ) : (
          <div className="space-y-2">
            {activeLoans.map((l) => {
              const paid = l.principal - l.balanceRemaining;
              const pct = (paid / l.principal) * 100;
              return (
                <div
                  key={l._id}
                  className="rounded-xl p-3 text-sm"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: "var(--fg)" }}>
                        {formatCurrency(l.principal)} principal
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                        Issued {formatDate(l.issuedAt)} &middot; {formatCurrency(l.perPeriodDeduction)}/period
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold" style={{ color: "var(--accent-color)" }}>
                        {formatCurrency(l.balanceRemaining)}
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted-fg)" }}>remaining</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: "var(--accent-color)" }}
                    />
                  </div>
                  {l.notes && (
                    <p className="text-xs mt-2 italic" style={{ color: "var(--muted-fg)" }}>
                      {l.notes}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmCancelLoan(l._id)}
                      className="text-xs text-red-400"
                    >
                      Cancel loan
                    </button>
                  </div>
                </div>
              );
            })}

            {otherLoans.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer" style={{ color: "var(--muted-fg)" }}>
                  {otherLoans.length} past loan{otherLoans.length === 1 ? "" : "s"}
                </summary>
                <div className="mt-2 space-y-1">
                  {otherLoans.map((l) => (
                    <div
                      key={l._id}
                      className="flex items-center justify-between"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      <span>
                        {l.status === "paid_off" ? "Paid off" : "Cancelled"} &middot;{" "}
                        {formatCurrency(l.principal)}
                      </span>
                      <span>
                        {l.completedAt ? formatDate(l.completedAt) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {showAddLoan && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted-fg)" }}>
                  Principal (₱)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newLoanPrincipal}
                  onChange={(e) => setNewLoanPrincipal(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="5000.00"
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono"
                  style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted-fg)" }}>
                  Per period (₱)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newLoanPerPeriod}
                  onChange={(e) => setNewLoanPerPeriod(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="500.00"
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono"
                  style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                />
              </div>
            </div>
            <input
              type="text"
              value={newLoanNotes}
              onChange={(e) => setNewLoanNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            />
            <button
              type="button"
              onClick={handleAddLoan}
              className="w-full py-2 rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              Issue Loan
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmRemoveDed !== null}
        title="Remove recurring deduction?"
        message="This won't affect already-finalized payslips."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={async () => {
          if (confirmRemoveDed) {
            await removeDeduction({ token, deductionId: confirmRemoveDed });
            setConfirmRemoveDed(null);
          }
        }}
        onCancel={() => setConfirmRemoveDed(null)}
      />

      <ConfirmModal
        open={confirmCancelLoan !== null}
        title="Cancel this loan?"
        message="The remaining balance will be wiped and no further auto-deductions will apply. Already-paid amounts stay recorded."
        confirmLabel="Cancel Loan"
        cancelLabel="Keep"
        onConfirm={async () => {
          if (confirmCancelLoan) {
            await updateLoan({
              token,
              loanId: confirmCancelLoan,
              status: "cancelled",
            });
            setConfirmCancelLoan(null);
          }
        }}
        onCancel={() => setConfirmCancelLoan(null)}
      />
    </div>
  );
}
