"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Thermal-printable BIR X/Z reading. Layout matches the format shown in
 * the BIR-accredited POS reference (RETAIL DYNAMICS sample):
 *
 *   Header — business name + address + VAT/TIN + SN + MIN
 *   Title  — "End Of Day Report (Z-Read)" or "X-Read"
 *   Counter block
 *   Transaction Summary
 *   Tender Summary
 *   Transaction Details
 *   VAT Computations
 *   Accumulated Grand Total (Z only)
 *
 * Uses the same print isolation as ReceiptView — adds body.printing-receipt
 * via the standard `triggerPrint` flow defined in globals.css.
 */

export type BirReadingViewData = {
  type: "x" | "z";
  zCounter: number;
  storeCode: string;
  terminalNo: number;
  generatedAt: number;
  generatedByName: string;
  windowStart: number;
  windowEnd: number;
  beginningSerial: string | null | undefined;
  endingSerial: string | null | undefined;
  salesInvoiceCounter: number;
  grossSales: number;
  returns: number;
  subtotal: number;
  scDiscounts: number;
  pwdDiscounts: number;
  otherDiscounts: number;
  vatAdjustments: number;
  netSales: number;
  grandTotal: number;
  cashTotal: number;
  cardTotal: number;
  ewalletTotal: number;
  salesTransactionCount: number;
  itemsSoldCount: number;
  noSalesCount: number;
  transactionReprintCount: number;
  cashDepositReprintCount: number;
  withdrawalReprintCount: number;
  lineVoidsCount: number;
  cancelledTransactionCount: number;
  priceOverridesCount: number;
  scTransactionCount: number;
  pwdTransactionCount: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  accumulatedGrandTotal: number;
  // Header data (from cached BIR settings)
  businessName: string;
  businessAddress: string;
  tin: string;
  vatStatus: "vat" | "non_vat" | "vat_exempt" | null;
  machineSerial: string;
  min: string;
};

function fmt(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtCount(n: number): string {
  return n.toLocaleString();
}
function fmtZ(n: number, width = 8): string {
  return String(n).padStart(width, "0");
}
function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}/${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
  return `${date} ${time}`;
}
function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

export function BirReadingView({
  reading,
  onClose,
}: {
  reading: BirReadingViewData;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const cleanup = () => document.body.classList.remove("printing-receipt");
    window.addEventListener("afterprint", cleanup);
    return () => {
      cleanup();
      window.removeEventListener("afterprint", cleanup);
    };
  }, []);

  const triggerPrint = () => {
    document.body.classList.add("printing-receipt");
    requestAnimationFrame(() => window.print());
  };

  if (!mounted) return null;

  const vatLabel =
    reading.vatStatus === "non_vat"
      ? "NON-VAT TIN"
      : reading.vatStatus === "vat_exempt"
        ? "VAT-EXEMPT TIN"
        : "VAT Registered TIN";

  const title =
    reading.type === "z" ? "End Of Day Report\n(Z-Read)" : "Reading Report\n(X-Read)";

  const node = (
    <div className="receipt-modal-host fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:p-0 print:bg-white print:block print:items-start">
      <div
        className="print-receipt rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden print:max-h-none print:block print:rounded-none print:shadow-none print:w-auto print:max-w-none"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="flex justify-end px-4 pt-3 shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="text-xl leading-none p-1 hover:opacity-80"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-2 font-mono text-xs print:overflow-visible print:block">
          {/* Header */}
          <div className="text-center mb-3">
            <p className="text-sm font-bold leading-tight uppercase">
              {reading.businessName || "—"}
            </p>
            <p className="text-[11px] leading-tight whitespace-pre-wrap">
              {reading.businessAddress || ""}
            </p>
            <p className="text-[11px] leading-tight mt-1">
              {vatLabel}: {reading.tin || "—"}
            </p>
            <p className="text-[11px] leading-tight">
              SN: {reading.machineSerial || "—"}   MIN: {reading.min || "—"}
            </p>
          </div>

          <div className="text-center my-3">
            <p className="text-[11px] whitespace-pre-line leading-tight">
              {title}
            </p>
          </div>

          {/* Counter block */}
          <Row label="Reset Counter No." value="Non-Resettable" />
          <Row label="Z-Counter" value={fmtZ(reading.zCounter)} />
          <Row label="Store Code" value={reading.storeCode} />
          <Row label="Terminal No." value={String(reading.terminalNo)} />
          <Row label="System Log Date" value={fmtDate(reading.windowEnd)} />
          <Row label="Computer Date/Time" value={fmtDateTime(reading.generatedAt)} />
          <Row
            label="Beginning SI Number"
            value={reading.beginningSerial ?? fmtZ(0)}
          />
          <Row
            label="Ending SI Number"
            value={reading.endingSerial ?? fmtZ(0)}
          />
          <Row label="Sales Invoice Counter" value={String(reading.salesInvoiceCounter)} />

          <Section title="TRANSACTION SUMMARY" />
          <Row
            label="Gross Sales"
            count={reading.salesTransactionCount}
            value={fmt(reading.grossSales)}
          />
          <Row label="  Less: Returns" value={fmt(reading.returns)} />
          <Divider />
          <Row label="Sub-Total:" value={fmt(reading.subtotal)} />

          <div className="mt-2 mb-1 text-[11px]">Less:</div>
          <Row label="  SC Discounts" value={fmt(reading.scDiscounts)} />
          <Row label="  PWD Discounts" value={fmt(reading.pwdDiscounts)} />
          <Row label="  Others (Regular)" value={fmt(reading.otherDiscounts)} />
          <Row label="  VAT Adjustments" value={fmt(reading.vatAdjustments)} />
          <Divider />
          <Row label="Net Sales:" value={fmt(reading.netSales)} bold />

          <Section title="TENDER SUMMARY" />
          {reading.cashTotal > 0 && (
            <Row
              label="CASH"
              count={reading.salesTransactionCount}
              value={fmt(reading.cashTotal)}
            />
          )}
          {reading.cardTotal > 0 && (
            <Row label="CARD" value={fmt(reading.cardTotal)} />
          )}
          {reading.ewalletTotal > 0 && (
            <Row label="E-WALLET" value={fmt(reading.ewalletTotal)} />
          )}
          <Divider />
          <Row label="Grand Total" value={fmt(reading.grandTotal)} bold />

          <Section title="TRANSACTION DETAILS" />
          <Row
            label="Sales Transaction Count"
            value={fmtCount(reading.salesTransactionCount)}
          />
          <Row
            label="Items Sold Count"
            value={fmtCount(reading.itemsSoldCount)}
          />
          <Row
            label="No Sales Transaction"
            value={fmtCount(reading.noSalesCount)}
          />
          <Row
            label="Transaction Reprint Count"
            value={fmtCount(reading.transactionReprintCount)}
          />
          <Row
            label="Cash Deposit Reprint Count"
            value={fmtCount(reading.cashDepositReprintCount)}
          />
          <Row
            label="Withdrawal Reprint Count"
            value={fmtCount(reading.withdrawalReprintCount)}
          />
          <Row
            label="Line Voids Count"
            value={fmtCount(reading.lineVoidsCount)}
          />
          <Row
            label="Cancelled Transaction Count"
            value={fmtCount(reading.cancelledTransactionCount)}
          />
          <Row
            label="Price Overrides"
            value={fmtCount(reading.priceOverridesCount)}
          />
          <Row
            label="SC Transaction Count"
            value={fmtCount(reading.scTransactionCount)}
          />
          <Row
            label="PWD Transaction Count"
            value={fmtCount(reading.pwdTransactionCount)}
          />

          <Section title="VAT COMPUTATIONS" />
          <Row label="VATable Sales" value={fmt(reading.vatableSales)} />
          <Row label="VAT Amount" value={fmt(reading.vatAmount)} />
          <Row label="VAT-Exempt Sales" value={fmt(reading.vatExemptSales)} />
          <Row label="Zero-Rated Sales" value={fmt(reading.zeroRatedSales)} />

          {reading.type === "z" && (
            <>
              <Section title="ACCUMULATED GRAND TOTAL" />
              <Row
                label="Old Accumulated"
                value={fmt(
                  reading.accumulatedGrandTotal - reading.grandTotal
                )}
              />
              <Row label="Today's Grand Total" value={fmt(reading.grandTotal)} />
              <Divider />
              <Row
                label="New Accumulated"
                value={fmt(reading.accumulatedGrandTotal)}
                bold
              />
            </>
          )}

          <div className="mt-3 text-center text-[10px]" style={{ color: "var(--muted-fg)" }}>
            <p>Generated by {reading.generatedByName}</p>
            {reading.type === "x" && (
              <p className="mt-1 italic">
                X-Read — informational only, does not close the day
              </p>
            )}
          </div>
        </div>

        <div
          className="px-6 pb-6 pt-3 flex gap-3 shrink-0 print:hidden"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button
            onClick={triggerPrint}
            className="flex-1 py-2.5 font-medium rounded-2xl hover:bg-stone-200 active:bg-stone-300 transition-colors text-sm"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-white font-medium rounded-2xl transition-colors text-sm"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function Row({
  label,
  value,
  count,
  bold,
}: {
  label: string;
  value: string;
  count?: number;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span className="whitespace-pre">{label}</span>
      <span className="flex items-baseline gap-3">
        {count !== undefined && (
          <span className="tabular-nums opacity-70">{count}</span>
        )}
        <span className="tabular-nums">{value}</span>
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-stone-300 my-1" />;
}

function Section({ title }: { title: string }) {
  return (
    <div className="text-center my-3">
      <p className="text-[11px] uppercase tracking-wider">{title}</p>
    </div>
  );
}
