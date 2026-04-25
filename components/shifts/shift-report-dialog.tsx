"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type ShiftReportDialogProps = {
  mode: "X" | "Z";
  shiftId?: Id<"shifts">;
  locationId: Id<"locations">;
  onClose: () => void;
};

type Summary = {
  kind: "X" | "Y" | "Z";
  generatedAt: number;
  itemCount: number;
  grossTotal: number;
  netTotal: number;
  taxTotal: number;
  cashTotal: number;
  cardTotal: number;
  ewalletTotal: number;
  refundedCount: number;
  refundedAmount: number;
};

type ShiftReport = Summary & {
  kind: "X" | "Y";
  userName: string;
  locationName: string;
  startedAt: number;
  endedAt?: number | null;
  status: string;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number;
  variance: number | null;
};

type DailyReport = Summary & {
  kind: "Z";
  locationName: string;
  dayStart: number;
  dayEnd: number;
  shiftCount: number;
};

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ShiftReportDialog({
  mode,
  shiftId,
  locationId,
  onClose,
}: ShiftReportDialogProps) {
  const { token } = useAuth();

  const xReport = useQuery(
    api.shifts.queries.getShiftReport,
    token && mode === "X" && shiftId ? { token, shiftId } : "skip"
  ) as ShiftReport | null | undefined;

  const zReport = useQuery(
    api.shifts.queries.getDailyReport,
    token && mode === "Z" ? { token, locationId } : "skip"
  ) as DailyReport | null | undefined;

  const report = mode === "X" ? xReport : zReport;
  const loading = report === undefined;

  const title =
    mode === "X" ? "X Reading — Shift Snapshot" : "Z Reading — Daily Total";
  const subtitle =
    mode === "X"
      ? "Mid-shift sales snapshot. Does not close the shift."
      : "Today's totals at this location, across every shift.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              {title}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl font-bold transition-colors active:scale-95"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {loading && (
            <p className="text-center py-12" style={{ color: "var(--muted-fg)" }}>
              Loading…
            </p>
          )}
          {!loading && !report && (
            <p className="text-center py-12 text-red-400">
              {mode === "X" ? "No active shift." : "Could not load daily totals."}
            </p>
          )}
          {report && (
            <div className="space-y-4">
              {/* Meta */}
              <div
                className="rounded-2xl p-4 space-y-1.5 text-sm"
                style={{ backgroundColor: "var(--muted)" }}
              >
                {report.kind !== "Z" ? (
                  <>
                    <Row label="Operator" value={(report as ShiftReport).userName} />
                    <Row label="Location" value={(report as ShiftReport).locationName} />
                    <Row
                      label="Started"
                      value={fmtTime((report as ShiftReport).startedAt)}
                    />
                    {(report as ShiftReport).endedAt && (
                      <Row
                        label="Ended"
                        value={fmtTime((report as ShiftReport).endedAt as number)}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <Row label="Location" value={(report as DailyReport).locationName} />
                    <Row label="Date" value={fmtDate((report as DailyReport).dayStart)} />
                    <Row
                      label="Shifts"
                      value={String((report as DailyReport).shiftCount)}
                    />
                  </>
                )}
                <Row label="Generated" value={fmtTime(report.generatedAt)} />
              </div>

              {/* Totals */}
              <Section title="Sales">
                <Row label="Orders" value={String(report.itemCount)} />
                <Row label="Net" value={formatCurrency(report.netTotal)} />
                <Row label="Tax" value={formatCurrency(report.taxTotal)} />
                <Row label="Gross" value={formatCurrency(report.grossTotal)} bold />
              </Section>

              <Section title="Tender">
                <Row label="Cash" value={formatCurrency(report.cashTotal)} />
                <Row label="Card" value={formatCurrency(report.cardTotal)} />
                <Row label="E-Wallet" value={formatCurrency(report.ewalletTotal)} />
              </Section>

              {report.refundedCount > 0 && (
                <Section title="Refunds">
                  <Row label="Count" value={String(report.refundedCount)} />
                  <Row
                    label="Amount"
                    value={`-${formatCurrency(report.refundedAmount)}`}
                  />
                </Section>
              )}

              {report.kind !== "Z" && (
                <Section title="Cash Drawer">
                  <Row
                    label="Opening cash"
                    value={formatCurrency((report as ShiftReport).openingCash)}
                  />
                  <Row
                    label="Cash sales"
                    value={formatCurrency(report.cashTotal)}
                  />
                  <Row
                    label="Expected"
                    value={formatCurrency((report as ShiftReport).expectedCash)}
                    bold
                  />
                  {(report as ShiftReport).closingCash !== null && (
                    <>
                      <Row
                        label="Closing cash"
                        value={formatCurrency(
                          (report as ShiftReport).closingCash as number
                        )}
                      />
                      <Row
                        label="Variance"
                        value={
                          ((report as ShiftReport).variance ?? 0) >= 0
                            ? `+${formatCurrency((report as ShiftReport).variance as number)}`
                            : `-${formatCurrency(-((report as ShiftReport).variance as number))}`
                        }
                        accent={
                          ((report as ShiftReport).variance ?? 0) === 0
                            ? "ok"
                            : "warn"
                        }
                      />
                    </>
                  )}
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex gap-3 shrink-0"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button
            onClick={() => window.print()}
            disabled={loading || !report}
            className="flex-1 py-3 rounded-2xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors active:scale-[0.99]"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            Done
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
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: "ok" | "warn";
}) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--muted-fg)" }}>{label}</span>
      <span
        className={bold ? "font-bold" : "font-medium"}
        style={{
          color:
            accent === "ok"
              ? "#10b981"
              : accent === "warn"
                ? "#f59e0b"
                : "var(--fg)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: "var(--muted-fg)" }}
      >
        {title}
      </h3>
      <div
        className="rounded-2xl p-4 space-y-1.5"
        style={{ backgroundColor: "var(--muted)" }}
      >
        {children}
      </div>
    </div>
  );
}
