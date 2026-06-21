"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/lib/auth-context";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  BirReadingView,
  type BirReadingViewData,
} from "@/components/reports/bir-reading-view";

type BirSettingsShape = {
  tenant: {
    businessName: string | null;
    businessAddress: string | null;
    tin: string | null;
    vatStatus: "vat" | "non_vat" | "vat_exempt" | null;
  };
  locations: Array<{
    _id: Id<"locations">;
    name: string;
    birMin: string | null;
    birMachineSerial: string | null;
  }>;
};

/**
 * Reports → BIR Readings. Lists the location's past Z-readings, lets the
 * operator pull an X-Read (informational) or run a Z-Read (closes the
 * business day). All reads print through the same BirReadingView so
 * they're identical on paper — the format is what BIR auditors expect.
 */
export default function BirReadingsPage() {
  const { token, session } = useAuth();
  const [activeReading, setActiveReading] = useState<BirReadingViewData | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationIds = session?.locationIds ?? [];
  const [selectedLocationId, setSelectedLocationId] = useState<
    Id<"locations"> | null
  >(locationIds[0] ?? null);

  const birSettings = useQuery(
    api.settings.bir.getBirSettings,
    token ? { token } : "skip"
  ) as BirSettingsShape | null | undefined;

  const readings = useQuery(
    api.reports.birReadings.listReadings,
    token && selectedLocationId
      ? { token, locationId: selectedLocationId, limit: 30 }
      : "skip"
  ) as Doc<"birReadings">[] | undefined;

  const fetchedX = useQuery(
    api.reports.birReadings.computeXRead,
    token && selectedLocationId
      ? { token, locationId: selectedLocationId }
      : "skip"
  );

  const generateZ = useMutation(api.reports.birReadings.generateZRead);

  const header = useMemo(() => {
    const loc = birSettings?.locations.find(
      (l) => l._id === selectedLocationId
    );
    return {
      businessName: birSettings?.tenant.businessName ?? "",
      businessAddress: birSettings?.tenant.businessAddress ?? "",
      tin: birSettings?.tenant.tin ?? "",
      vatStatus: birSettings?.tenant.vatStatus ?? null,
      machineSerial: loc?.birMachineSerial ?? "",
      min: loc?.birMin ?? "",
    };
  }, [birSettings, selectedLocationId]);

  const openSavedReading = (row: Doc<"birReadings">) => {
    setActiveReading({
      type: "z",
      zCounter: row.zCounter,
      storeCode: row.storeCode,
      terminalNo: row.terminalNo,
      generatedAt: row.generatedAt,
      generatedByName: "—", // we don't denormalize the cashier name
      windowStart: row.windowStart,
      windowEnd: row.windowEnd,
      beginningSerial: row.beginningSerial,
      endingSerial: row.endingSerial,
      salesInvoiceCounter: row.salesInvoiceCounter,
      grossSales: row.grossSales,
      returns: row.returns,
      subtotal: row.subtotal,
      scDiscounts: row.scDiscounts,
      pwdDiscounts: row.pwdDiscounts,
      otherDiscounts: row.otherDiscounts,
      vatAdjustments: row.vatAdjustments,
      netSales: row.netSales,
      grandTotal: row.grandTotal,
      cashTotal: row.cashTotal,
      cardTotal: row.cardTotal,
      ewalletTotal: row.ewalletTotal,
      salesTransactionCount: row.salesTransactionCount,
      itemsSoldCount: row.itemsSoldCount,
      noSalesCount: row.noSalesCount,
      transactionReprintCount: row.transactionReprintCount,
      cashDepositReprintCount: row.cashDepositReprintCount,
      withdrawalReprintCount: row.withdrawalReprintCount,
      lineVoidsCount: row.lineVoidsCount,
      cancelledTransactionCount: row.cancelledTransactionCount,
      priceOverridesCount: row.priceOverridesCount,
      scTransactionCount: row.scTransactionCount,
      pwdTransactionCount: row.pwdTransactionCount,
      vatableSales: row.vatableSales,
      vatAmount: row.vatAmount,
      vatExemptSales: row.vatExemptSales,
      zeroRatedSales: row.zeroRatedSales,
      accumulatedGrandTotal: row.accumulatedGrandTotalAfter,
      ...header,
    });
  };

  const openLiveX = () => {
    if (!fetchedX) return;
    setActiveReading({ ...fetchedX, ...header });
  };

  const handleGenerateZ = async () => {
    if (!token || !selectedLocationId) return;
    if (
      !confirm(
        "Run Z-Read? This closes the business day, increments the Z-counter, and writes a permanent audit row. Cannot be undone."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await generateZ({ token, locationId: selectedLocationId });
      setActiveReading({ ...result, ...header });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Z-Read failed");
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--muted-fg)" }}
          >
            BIR Reports
          </p>
          <h1 className="text-2xl font-bold mt-1">X / Z Readings</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
            X-Read is the mid-day snapshot. Z-Read closes the business day,
            increments the gap-less Z-counter, and is permanent.
          </p>
        </div>

        {birSettings && birSettings.locations.length > 1 && (
          <select
            value={selectedLocationId ?? ""}
            onChange={(e) =>
              setSelectedLocationId(e.target.value as Id<"locations">)
            }
            className="rounded-2xl px-3 py-2 text-sm focus:outline-none"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          >
            {birSettings.locations
              .filter((l) => locationIds.includes(l._id))
              .map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid md:grid-cols-2 gap-3 mb-6">
        <button
          onClick={openLiveX}
          disabled={!fetchedX || busy}
          className="text-left rounded-3xl p-4 disabled:opacity-50"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted-fg)" }}
          >
            Mid-day snapshot
          </p>
          <p className="text-lg font-bold mt-1" style={{ color: "var(--fg)" }}>
            X-Read · today
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>
            Informational only. Doesn't reset counters or write to the audit
            trail. Run anytime.
          </p>
        </button>

        <button
          onClick={handleGenerateZ}
          disabled={busy}
          className="text-left rounded-3xl p-4 disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent-color)",
            color: "white",
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest opacity-80"
          >
            End-of-day close
          </p>
          <p className="text-lg font-bold mt-1">
            {busy ? "Running…" : "Z-Read · close day"}
          </p>
          <p className="text-xs mt-1 opacity-90">
            Closes today, increments the Z-counter, and writes a permanent
            BIR audit row. Owner / manager only.
          </p>
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-2xl p-3 text-sm"
          style={{
            backgroundColor: "rgba(239,68,68,0.1)",
            color: "#b91c1c",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* History */}
      <h2
        className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: "var(--muted-fg)" }}
      >
        Past Z-Reads
      </h2>
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        {readings === undefined ? (
          <p
            className="p-6 text-center text-sm"
            style={{ color: "var(--muted-fg)" }}
          >
            Loading…
          </p>
        ) : readings.length === 0 ? (
          <p
            className="p-6 text-center text-sm"
            style={{ color: "var(--muted-fg)" }}
          >
            No Z-Reads yet. Run the first close-of-day to start the audit trail.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <Th>Z #</Th>
                <Th>Date</Th>
                <Th align="right">SI Count</Th>
                <Th align="right">Net Sales</Th>
                <Th align="right">Grand Total</Th>
                <Th align="right">Accumulated</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr
                  key={r._id}
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <td
                    className="px-3 py-2 font-mono text-[11px]"
                    style={{ color: "var(--fg)" }}
                  >
                    {String(r.zCounter).padStart(8, "0")}
                  </td>
                  <td
                    className="px-3 py-2 text-xs"
                    style={{ color: "var(--fg)" }}
                  >
                    {new Date(r.generatedAt).toLocaleString()}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {r.salesInvoiceCounter}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-mono"
                    style={{ color: "var(--fg)" }}
                  >
                    ₱{(r.netSales / 100).toLocaleString()}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-mono font-semibold"
                    style={{ color: "var(--fg)" }}
                  >
                    ₱{(r.grandTotal / 100).toLocaleString()}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-mono text-[11px]"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    ₱{(r.accumulatedGrandTotalAfter / 100).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => openSavedReading(r)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{
                        backgroundColor: "var(--muted)",
                        color: "var(--fg)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      Re-print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {activeReading && (
        <BirReadingView
          reading={activeReading}
          onClose={() => setActiveReading(null)}
        />
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: "var(--muted-fg)" }}
    >
      {children}
    </th>
  );
}
