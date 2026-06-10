"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBranding } from "@/components/providers/branding-provider";

/**
 * Receipt rendering for offline-mode checkout. Mirrors the BIR-compliant
 * branch of `ReceiptView` but reads from local sources (cached BIR
 * settings, the local draft snapshot, the pre-allocated serial) instead
 * of querying the server. The cashier hands the customer a printed
 * receipt with the real OR number even though the order hasn't synced
 * yet — the same number reappears on the synced receipt later, so an
 * auditor sees one number per transaction.
 */

export type LocalReceiptLineItem = {
  name: string;
  quantity: number;
  basePrice: number;
  modifiers: Array<{ name: string; priceAdj: number }>;
};

export type LocalReceiptData = {
  birSerial: string | null; // OR-MAIN-00001234 from the pool, or null
  fallbackNumber: string; // OFFLINE-XXX when serial unavailable
  completedAt: number;
  baristaName: string;
  locationName: string;
  locationAddress: string;
  paymentType: string;
  payments: Array<{
    type: string;
    amount: number;
    tendered?: number;
    change?: number;
  }>;
  items: LocalReceiptLineItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number; // bps, e.g. 1200 = 12%
  taxLabel: string;
  total: number;
  discountAmount: number;
  discountReason: string | null;
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  bir: {
    businessName: string | null;
    tradeName: string | null;
    businessAddress: string | null;
    tin: string | null;
    vatStatus: "vat" | "non_vat" | "vat_exempt" | null;
    accreditedSupplierName: string | null;
    accreditedSupplierAccreditation: string | null;
    ptu: string | null;
    min: string | null;
    atp: string | null;
    srPwdType: "senior" | "pwd" | null;
    srPwdName: string | null;
    srPwdId: string | null;
  };
};

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}
function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatPaymentType(type: string): string {
  switch (type) {
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    case "ewallet":
      return "E-Wallet";
    default:
      return type;
  }
}

type Props = {
  receipt: LocalReceiptData;
  onClose: () => void;
};

export function LocalReceiptView({ receipt, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const { brandName, entitlements } = useBranding();
  const poweredByName = brandName || "bevi&go";
  const showPoweredBy = !entitlements.hidePoweredBy;
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

  const { bir } = receipt;
  const usesBir = !!(bir.tin && bir.businessName);
  const vatStatusLabel =
    bir.vatStatus === "vat"
      ? "VAT REG TIN"
      : bir.vatStatus === "non_vat"
        ? "NON-VAT TIN"
        : bir.vatStatus === "vat_exempt"
          ? "VAT-EXEMPT TIN"
          : "TIN";

  const node = (
    <div className="receipt-modal-host fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:p-0 print:bg-white print:block print:items-start">
      <div
        className="print-receipt rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden print:max-h-none print:block print:rounded-none print:shadow-none print:w-auto print:max-w-none"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        {/* Close button - hidden in print */}
        <div className="flex justify-end px-4 pt-3 shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="text-xl leading-none p-1 hover:opacity-80"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-2 font-mono text-sm print:overflow-visible print:block">
          {/* Pending-sync ribbon — operator-facing only, hidden in print */}
          <div
            className="rounded-xl px-2 py-1 mb-2 text-[10px] uppercase tracking-widest font-bold text-center print:hidden"
            style={{
              backgroundColor: "rgba(245,158,11,0.15)",
              color: "#b45309",
            }}
          >
            Pending sync · receipt is BIR-valid
          </div>

          {/* Header */}
          <div className="text-center mb-3">
            {usesBir ? (
              <>
                <p className="text-sm font-bold leading-tight">
                  {bir.businessName}
                </p>
                {bir.tradeName && (
                  <p className="text-xs italic leading-tight">
                    ({bir.tradeName})
                  </p>
                )}
                <p className="text-xs leading-tight mt-0.5">
                  {bir.businessAddress ?? receipt.locationAddress}
                </p>
                <p className="text-xs leading-tight mt-0.5">
                  {vatStatusLabel}: {bir.tin}
                </p>
                <p className="text-xs leading-tight mt-1">
                  {receipt.locationName}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-bold">{receipt.locationName}</p>
                {receipt.locationAddress && (
                  <p className="text-xs mt-0.5">{receipt.locationAddress}</p>
                )}
              </>
            )}
          </div>

          {/* OR / SI heading */}
          <div className="text-center mb-2">
            {usesBir && (
              <p className="text-xs font-bold uppercase tracking-widest">
                {bir.vatStatus === "non_vat"
                  ? "Sales Invoice"
                  : "Official Receipt"}
              </p>
            )}
            <p className="text-xs">
              #{receipt.birSerial ?? receipt.fallbackNumber}
            </p>
            <p className="text-xs">{formatDateTime(receipt.completedAt)}</p>
          </div>

          <div className="border-t border-dashed border-stone-300 my-2" />

          {/* Items */}
          <div className="space-y-1.5">
            {receipt.items.map((item, idx) => {
              const modSum = item.modifiers.reduce(
                (s, m) => s + m.priceAdj,
                0
              );
              const lineSubtotal = (item.basePrice + modSum) * item.quantity;
              return (
                <div key={idx}>
                  <div className="flex justify-between">
                    <span>
                      {item.quantity > 1 && (
                        <span style={{ color: "var(--muted-fg)" }}>
                          {item.quantity}x{" "}
                        </span>
                      )}
                      {item.name}
                    </span>
                    <span className="ml-2 flex-shrink-0">
                      {formatPrice(lineSubtotal)}
                    </span>
                  </div>
                  {item.modifiers.map((mod, modIdx) => (
                    <div
                      key={modIdx}
                      className="flex justify-between text-xs pl-3"
                    >
                      <span>+ {mod.name}</span>
                      {mod.priceAdj > 0 && (
                        <span className="ml-2 flex-shrink-0">
                          {formatPrice(mod.priceAdj)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="border-t border-dashed border-stone-300 my-2" />

          {/* VAT / Sales breakdown — always shown in offline mode, since
              if the cashier got here without BIR identity the receipt
              would not be compliant anyway. */}
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span>Vatable sales</span>
              <span>{formatPrice(receipt.vatableSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT-exempt sales</span>
              <span>{formatPrice(receipt.vatExemptSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>Zero-rated sales</span>
              <span>{formatPrice(receipt.zeroRatedSales)}</span>
            </div>
            <div className="flex justify-between mt-1 pt-1 border-t border-stone-300">
              <span>Subtotal (gross)</span>
              <span>{formatPrice(receipt.subtotal)}</span>
            </div>
            {receipt.discountAmount > 0 && (
              <div className="flex justify-between">
                <span>Less: {receipt.discountReason ?? "Discount"}</span>
                <span>− {formatPrice(receipt.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>
                {receipt.taxLabel} (
                {(receipt.taxRate / 100).toFixed(0)}%)
              </span>
              <span>{formatPrice(receipt.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-stone-300">
              <span>Total</span>
              <span>{formatPrice(receipt.total)}</span>
            </div>
          </div>

          {/* Payment type */}
          <div className="mt-3 text-center text-xs">
            <p>Paid by: {formatPaymentType(receipt.paymentType)}</p>
          </div>

          {/* Cash tender + change */}
          {receipt.payments.some(
            (p) => p.type === "cash" && p.tendered !== undefined
          ) && (
            <div className="mt-2 space-y-0.5">
              {receipt.payments
                .filter((p) => p.type === "cash" && p.tendered !== undefined)
                .map((p, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs">
                      <span>Cash tendered</span>
                      <span>{formatPrice(p.tendered ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Change</span>
                      <span>{formatPrice(p.change ?? 0)}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Senior/PWD block */}
          {bir.srPwdType && (
            <>
              <div className="border-t border-dashed border-stone-300 my-2" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold uppercase">
                  {bir.srPwdType === "senior" ? "Senior Citizen" : "PWD"}{" "}
                  Discount
                </p>
                <p>Name: {bir.srPwdName ?? "—"}</p>
                <p>
                  {bir.srPwdType === "senior" ? "OSCA ID" : "PWD ID"}:{" "}
                  {bir.srPwdId ?? "—"}
                </p>
                <p className="mt-3">Signature: ___________________</p>
              </div>
            </>
          )}

          <div className="border-t border-dashed border-stone-300 my-2" />

          {/* Cashier + BIR footer */}
          <div className="text-center text-[10px] leading-tight space-y-0.5">
            <p>Served by: {receipt.baristaName}</p>
            {usesBir && (
              <>
                {bir.ptu && <p>PTU #: {bir.ptu}</p>}
                {bir.min && <p>MIN: {bir.min}</p>}
                {bir.atp && <p>ATP #: {bir.atp}</p>}
                {bir.accreditedSupplierName && (
                  <p>
                    Acc. by {bir.accreditedSupplierName}
                    {bir.accreditedSupplierAccreditation
                      ? ` (${bir.accreditedSupplierAccreditation})`
                      : ""}
                  </p>
                )}
                <p className="mt-2 font-semibold uppercase">
                  {bir.vatStatus === "non_vat"
                    ? "This invoice/receipt shall be valid for five (5) years from the date of the permit to use."
                    : "This document is not valid for claim of input tax."}
                </p>
                <p>
                  THIS RECEIPT SHALL BE VALID FOR FIVE (5) YEARS FROM THE
                  DATE OF THE PERMIT TO USE.
                </p>
              </>
            )}
            {showPoweredBy && (
              <p className="text-stone-400 mt-2">Powered by {poweredByName}</p>
            )}
          </div>
        </div>

        {/* Action buttons - hidden in print */}
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
            className="flex-1 py-2.5 text-white font-medium rounded-2xl hover:bg-stone-900 active:bg-stone-950 transition-colors text-sm"
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
