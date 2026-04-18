"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type PayslipDetail = {
  _id: Id<"payslips">;
  periodLabel: string;
  periodStart: number;
  periodEnd: number;
  periodStatus: "draft" | "finalized";
  tenantName: string;
  currency: string;
  userName: string;
  regularMinutes: number;
  overtimeMinutes: number;
  hourlyRateSnapshot: number;
  overtimeMultiplier: number;
  grossPay: number;
  allowances: { label: string; amount: number }[];
  deductions: { label: string; amount: number; loanId?: Id<"staffLoans"> }[];
  netPay: number;
  status: "draft" | "finalized" | "paid";
  paidAt?: number;
  paidVia?: string;
  paidNote?: string;
  notes?: string;
  days: Array<{
    _id: Id<"timesheets">;
    clockInAt: number;
    clockOutAt: number | null;
    workMinutes: number;
    breakMinutes: number;
    overtimeMinutes: number;
    earnedAmount: number;
  }>;
};

type PayslipModalProps = {
  payslipId: Id<"payslips">;
  onClose: () => void;
};

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatHM(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatLong(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const A4_PRINT_STYLE_ID = "payslip-a4-print";

function injectA4PrintStyle() {
  if (document.getElementById(A4_PRINT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = A4_PRINT_STYLE_ID;
  style.textContent = `@media print { @page { size: A4; margin: 12mm } }`;
  document.head.appendChild(style);
}

function removeA4PrintStyle() {
  const el = document.getElementById(A4_PRINT_STYLE_ID);
  if (el) el.remove();
}

export function PayslipModal({ payslipId, onClose }: PayslipModalProps) {
  const { token } = useAuth();
  const data = useQuery(
    api.payroll.queries.getPayslipDetail,
    token ? { token, payslipId } : "skip"
  ) as PayslipDetail | undefined;

  useEffect(() => {
    const onAfter = () => removeA4PrintStyle();
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("afterprint", onAfter);
      removeA4PrintStyle();
    };
  }, []);

  const handlePrint = () => {
    injectA4PrintStyle();
    setTimeout(() => window.print(), 50);
  };

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

  const totalAllow = data.allowances.reduce((s, a) => s + a.amount, 0);
  const totalDed = data.deductions.reduce((s, d) => s + d.amount, 0);
  const otRateMultiplier = data.overtimeMultiplier / 10000;
  const regularPay = Math.round((data.regularMinutes / 60) * data.hourlyRateSnapshot);
  const otPay = Math.round(
    (data.overtimeMinutes / 60) * data.hourlyRateSnapshot * otRateMultiplier
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-auto print:p-0 print:bg-white">
      <div
        className="print-payslip rounded-3xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {/* Header (hidden in print) */}
        <div
          className="px-6 py-4 flex items-center justify-between print:hidden"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            Payslip
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        {/* Printable body */}
        <div className="p-8 print:p-0" style={{ color: "var(--fg)" }}>
          {/* Letterhead */}
          <div className="text-center mb-6 pb-4" style={{ borderBottom: "2px solid currentColor" }}>
            <p className="text-xl font-bold tracking-tight">{data.tenantName}</p>
            <p className="text-xs uppercase tracking-widest mt-1" style={{ color: "var(--muted-fg)" }}>
              Payslip
            </p>
          </div>

          {/* Identity / period */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--muted-fg)" }}>
                Employee
              </p>
              <p className="font-semibold text-base">{data.userName}</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>
                Hourly rate: {formatCurrency(data.hourlyRateSnapshot, data.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--muted-fg)" }}>
                Pay Period
              </p>
              <p className="font-semibold text-base">{data.periodLabel}</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>
                {formatLong(data.periodStart)} – {formatLong(data.periodEnd)}
              </p>
            </div>
          </div>

          {/* Day-by-day breakdown */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
              Days Worked
            </p>
            {data.days.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: "var(--muted-fg)" }}>
                No completed shifts in this period.
              </p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "var(--muted)" }}>
                      <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>Day</th>
                      <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>In</th>
                      <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>Out</th>
                      <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>Break</th>
                      <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>Hours</th>
                      <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>OT</th>
                      <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map((d) => (
                      <tr key={d._id} style={{ borderTop: "1px solid var(--border-color)" }}>
                        <td className="px-3 py-2 font-medium">{formatDay(d.clockInAt)}</td>
                        <td className="px-3 py-2 font-mono">{formatHM(d.clockInAt)}</td>
                        <td className="px-3 py-2 font-mono">{formatHM(d.clockOutAt)}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--muted-fg)" }}>
                          {d.breakMinutes > 0 ? formatHours(d.breakMinutes) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatHours(Math.max(0, d.workMinutes - d.overtimeMinutes))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {d.overtimeMinutes > 0 ? formatHours(d.overtimeMinutes) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(d.earnedAmount, data.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Earnings + deductions */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                Earnings
              </p>
              <div className="space-y-1 text-sm">
                <Row label={`Regular (${formatHours(data.regularMinutes)})`} value={formatCurrency(regularPay, data.currency)} />
                {data.overtimeMinutes > 0 && (
                  <Row
                    label={`Overtime (${formatHours(data.overtimeMinutes)} × ${otRateMultiplier.toFixed(2)})`}
                    value={formatCurrency(otPay, data.currency)}
                  />
                )}
                {data.allowances.map((a, i) => (
                  <Row key={i} label={a.label} value={`+ ${formatCurrency(a.amount, data.currency)}`} />
                ))}
                <Row
                  label="Subtotal"
                  value={formatCurrency(data.grossPay + totalAllow, data.currency)}
                  bold
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                Deductions
              </p>
              {data.deductions.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
                  None
                </p>
              ) : (
                <div className="space-y-1 text-sm">
                  {data.deductions.map((d, i) => (
                    <Row key={i} label={d.label} value={`− ${formatCurrency(d.amount, data.currency)}`} />
                  ))}
                  <Row label="Subtotal" value={`− ${formatCurrency(totalDed, data.currency)}`} bold />
                </div>
              )}
            </div>
          </div>

          {/* Net pay */}
          <div
            className="rounded-2xl p-5 flex items-center justify-between print:rounded-none print:border print:border-black"
            style={{ backgroundColor: "var(--muted)" }}
          >
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--muted-fg)" }}>
                Net Pay
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                Gross + Allowances − Deductions
              </p>
            </div>
            <p className="text-3xl font-bold font-mono">
              {formatCurrency(data.netPay, data.currency)}
            </p>
          </div>

          {/* Payment status */}
          {data.status === "paid" && (
            <div className="mt-4 text-sm flex justify-between" style={{ color: "var(--muted-fg)" }}>
              <span>
                Paid via <span className="font-semibold capitalize">{data.paidVia}</span>
                {data.paidAt && ` on ${formatLong(data.paidAt)}`}
              </span>
              {data.paidNote && <span className="italic">{data.paidNote}</span>}
            </div>
          )}

          {data.notes && (
            <div className="mt-4 text-sm" style={{ color: "var(--muted-fg)" }}>
              <span className="font-semibold">Notes:</span> {data.notes}
            </div>
          )}

          <p className="text-center text-xs mt-8" style={{ color: "var(--muted-fg)" }}>
            Generated by bevi&amp;go
          </p>
        </div>

        {/* Footer (hidden in print) */}
        <div
          className="px-6 py-4 flex justify-end gap-3 print:hidden"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            Print Payslip
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-bold pt-1" : ""}`}
      style={bold ? { borderTop: "1px solid var(--border-color)" } : undefined}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
