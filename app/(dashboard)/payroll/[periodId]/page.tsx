"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PayslipModal } from "@/components/payroll/payslip-modal";
import { EditPayslipModal } from "@/components/payroll/edit-payslip-modal";
import { MarkPaidModal } from "@/components/payroll/mark-paid-modal";

type Payslip = {
  _id: Id<"payslips">;
  userId: Id<"users">;
  userName: string;
  regularMinutes: number;
  overtimeMinutes: number;
  hourlyRateSnapshot: number;
  grossPay: number;
  allowancesTotal: number;
  deductionsTotal: number;
  netPay: number;
  status: "draft" | "finalized" | "paid";
  paidAt?: number;
  paidVia?: "cash" | "bank" | "gcash" | "maya" | "other";
};

type Period = {
  _id: Id<"payPeriods">;
  label: string;
  startDate: number;
  endDate: number;
  status: "draft" | "finalized";
  finalizedAt?: number;
  payslips: Payslip[];
};

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PayrollPeriodPage() {
  const params = useParams<{ periodId: string }>();
  const router = useRouter();
  const { session, token } = useAuth();
  const periodId = params.periodId as Id<"payPeriods">;

  const period = useQuery(
    api.payroll.queries.getPeriod,
    token ? { token, periodId } : "skip"
  ) as Period | undefined;

  const finalizePeriod = useMutation(api.payroll.mutations.finalizePeriod);
  const regeneratePayslip = useMutation(api.payroll.mutations.regeneratePayslip);

  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [viewingPayslip, setViewingPayslip] = useState<Id<"payslips"> | null>(
    null
  );
  const [editingPayslip, setEditingPayslip] = useState<Id<"payslips"> | null>(
    null
  );
  const [markingPaid, setMarkingPaid] = useState<{
    payslipId: Id<"payslips">;
    netPay: number;
    name: string;
  } | null>(null);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }
  if (session.role !== "owner") {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Owners only.</p>
      </div>
    );
  }
  if (period === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading period...</p>
      </div>
    );
  }

  const payslips = period.payslips;
  const totalGross = payslips.reduce((s, p) => s + p.grossPay, 0);
  const totalAllow = payslips.reduce((s, p) => s + p.allowancesTotal, 0);
  const totalDed = payslips.reduce((s, p) => s + p.deductionsTotal, 0);
  const totalNet = payslips.reduce((s, p) => s + p.netPay, 0);
  const paidCount = payslips.filter((p) => p.status === "paid").length;
  const allPaid = payslips.length > 0 && paidCount === payslips.length;

  const handleFinalize = async () => {
    try {
      await finalizePeriod({ token, periodId });
    } finally {
      setConfirmFinalize(false);
    }
  };

  const handleRegenerate = async (id: Id<"payslips">) => {
    await regeneratePayslip({ token, payslipId: id });
  };

  return (
    <div>
      <button
        onClick={() => router.push("/payroll")}
        className="text-sm mb-3"
        style={{ color: "var(--muted-fg)" }}
      >
        ← All pay periods
      </button>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
            {period.label}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            {formatDate(period.startDate)} – {formatDate(period.endDate)} &middot;{" "}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                period.status === "finalized"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}
            >
              {period.status === "finalized" ? "Finalized" : "Draft"}
            </span>
          </p>
        </div>
        {period.status === "draft" && payslips.length > 0 && (
          <button
            onClick={() => setConfirmFinalize(true)}
            className="px-4 py-2.5 text-white text-sm font-semibold rounded-xl"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            Finalize Period
          </button>
        )}
        {period.status === "finalized" && allPaid && (
          <span className="text-sm font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
            All {paidCount} payslips paid
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Gross" value={formatCurrency(totalGross)} />
        <SummaryCard label="Allowances" value={`+ ${formatCurrency(totalAllow)}`} />
        <SummaryCard label="Deductions" value={`− ${formatCurrency(totalDed)}`} />
        <SummaryCard label="Net Total" value={formatCurrency(totalNet)} highlight />
      </div>

      {/* Payslip table */}
      <div
        className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {payslips.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p style={{ color: "var(--muted-fg)" }}>
              No payslips were generated. Make sure staff have completed timesheets and an hourly rate set.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Staff
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Hours
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  OT
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Gross
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Allow
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Deduct
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Net
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Status
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((ps) => (
                <tr key={ps._id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: "var(--fg)" }}>
                    {ps.userName}
                    <div className="text-xs font-normal" style={{ color: "var(--muted-fg)" }}>
                      {formatCurrency(ps.hourlyRateSnapshot)}/hr
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono">{formatHours(ps.regularMinutes)}</td>
                  <td className="px-5 py-3.5 text-right font-mono" style={{ color: ps.overtimeMinutes > 0 ? "var(--accent-color)" : "var(--muted-fg)" }}>
                    {ps.overtimeMinutes > 0 ? formatHours(ps.overtimeMinutes) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono">{formatCurrency(ps.grossPay)}</td>
                  <td className="px-5 py-3.5 text-right font-mono" style={{ color: "var(--muted-fg)" }}>
                    {ps.allowancesTotal > 0 ? `+${formatCurrency(ps.allowancesTotal)}` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono" style={{ color: ps.deductionsTotal > 0 ? "#ef4444" : "var(--muted-fg)" }}>
                    {ps.deductionsTotal > 0 ? `−${formatCurrency(ps.deductionsTotal)}` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold">
                    {formatCurrency(ps.netPay)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        ps.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : ps.status === "finalized"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {ps.status === "paid"
                        ? `Paid · ${ps.paidVia ?? ""}`
                        : ps.status === "finalized"
                        ? "Finalized"
                        : "Draft"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="flex items-center justify-end gap-3 text-xs">
                      <button
                        onClick={() => setViewingPayslip(ps._id)}
                        className="text-amber-400 font-medium"
                      >
                        View
                      </button>
                      {ps.status === "draft" && (
                        <>
                          <button
                            onClick={() => setEditingPayslip(ps._id)}
                            className="text-blue-400"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRegenerate(ps._id)}
                            style={{ color: "var(--muted-fg)" }}
                          >
                            Regenerate
                          </button>
                        </>
                      )}
                      {ps.status === "finalized" && (
                        <button
                          onClick={() =>
                            setMarkingPaid({
                              payslipId: ps._id,
                              netPay: ps.netPay,
                              name: ps.userName,
                            })
                          }
                          className="text-emerald-400 font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={confirmFinalize}
        title="Finalize this pay period?"
        message="Once finalized, payslips can no longer be edited. You can then mark each one as paid. This cannot be undone."
        confirmLabel="Finalize"
        cancelLabel="Cancel"
        onConfirm={handleFinalize}
        onCancel={() => setConfirmFinalize(false)}
      />

      {viewingPayslip && (
        <PayslipModal
          payslipId={viewingPayslip}
          onClose={() => setViewingPayslip(null)}
        />
      )}

      {editingPayslip && (
        <EditPayslipModal
          payslipId={editingPayslip}
          onClose={() => setEditingPayslip(null)}
        />
      )}

      {markingPaid && (
        <MarkPaidModal
          payslipId={markingPaid.payslipId}
          netPay={markingPaid.netPay}
          staffName={markingPaid.name}
          onClose={() => setMarkingPaid(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: highlight ? "var(--accent-color)" : "var(--card)",
        border: "1px solid var(--border-color)",
        color: highlight ? "white" : "var(--fg)",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
        {label}
      </p>
      <p className="text-xl font-bold mt-1 font-mono">{value}</p>
    </div>
  );
}
