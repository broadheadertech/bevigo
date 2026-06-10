"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { Id } from "../../convex/_generated/dataModel";
import type { LocalDraft } from "@/lib/offline/local-draft";
import { claimNextSerial, releaseClaim } from "@/lib/offline/serial-pool";
import { enqueueMutation } from "@/lib/offline/queue-replay";
import { formatCurrency } from "@/lib/currency";

type PaymentType = "cash" | "card" | "ewallet";

export type OfflineCheckoutResult = {
  orderNumber: string;
  paymentType: PaymentType;
  payments: Array<{
    type: PaymentType;
    amount: number;
    tendered?: number;
    change?: number;
  }>;
  completedAt: number;
  claimedSerial: string | null;
};

type Props = {
  draft: LocalDraft;
  totals: {
    subtotal: number;
    discount: number;
    vatableSales: number;
    vatExemptSales: number;
    taxAmount: number;
    total: number;
  };
  locationId: Id<"locations">;
  taxRateBps: number;
  onClose: () => void;
  onCompleted: (result: OfflineCheckoutResult) => void;
};

/**
 * Offline checkout — selects a payment type, captures cash tender if
 * needed, claims a pre-allocated BIR serial, and enqueues a single
 * `submitOfflineOrder` mutation with the whole bundle. Once the queue
 * accepts the entry the cashier sees the receipt with the real OR
 * number and the local draft is cleared.
 */
export function OfflineCheckoutDialog({
  draft,
  totals,
  locationId,
  onClose,
  onCompleted,
}: Props) {
  const { token } = useAuth();
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [cashTendered, setCashTendered] = useState<string>(
    (totals.total / 100).toFixed(2)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenderedCents = Math.round(parseFloat(cashTendered || "0") * 100);
  const change = tenderedCents - totals.total;
  const canPay =
    paymentType !== "cash" || tenderedCents >= totals.total;

  const handleConfirm = async () => {
    if (!token || isProcessing || !canPay) return;
    setIsProcessing(true);
    setError(null);

    // Claim a pre-allocated serial BEFORE we hand the order to the
    // queue. If claiming or enqueueing throws (IDB error, quota), we
    // release the claim so the serial is reused on the next attempt.
    const claim = await claimNextSerial(locationId);
    try {
      await enqueueMutation(
        "orders/mutations:submitOfflineOrder",
        {
          token,
          clientOrderId: draft.clientOrderId,
          locationId,
          tableId: draft.tableId,
          tableName: draft.tableName,
          customerId: draft.customerId,
          customerLabel: draft.customerLabel,
          items: draft.items.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            modifiers: line.modifiers,
            customerLabel: line.customerLabel,
          })),
          discount: draft.discount,
          paymentType,
          cashTendered:
            paymentType === "cash" ? tenderedCents : undefined,
          clientBirSerial: claim
            ? {
                reservationId: claim.reservationId,
                serialNumber: claim.serialNumber,
                deviceId: claim.deviceId,
              }
            : undefined,
        },
        {
          claimedSerial: claim?.formatted,
          locationId: String(locationId),
        }
      );

      // Receipt identifier: prefer the real BIR serial when we have
      // one, otherwise fall back to a synthetic OFFLINE-XXX so the
      // operator can still match it to the queue entry.
      const finalPayments =
        paymentType === "cash"
          ? [
              {
                type: "cash" as const,
                amount: totals.total,
                tendered: tenderedCents,
                change: tenderedCents - totals.total,
              },
            ]
          : [{ type: paymentType, amount: totals.total }];
      onCompleted({
        orderNumber:
          claim?.formatted ??
          `OFFLINE-${draft.clientOrderId.slice(0, 8).toUpperCase()}`,
        paymentType,
        payments: finalPayments,
        completedAt: Date.now(),
        claimedSerial: claim?.formatted ?? null,
      });
    } catch (e) {
      if (claim) await releaseClaim(locationId, claim.serialNumber);
      setError(e instanceof Error ? e.message : "Checkout failed");
      setIsProcessing(false);
    }
  };

  const paymentOptions: { type: PaymentType; label: string }[] = [
    { type: "cash", label: "Cash" },
    { type: "card", label: "Card" },
    { type: "ewallet", label: "E-Wallet" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="rounded-3xl p-5 w-full max-w-sm shadow-xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--muted-fg)" }}
            >
              Offline Checkout
            </p>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              {formatCurrency(totals.total)} due
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-xs font-semibold"
            style={{ color: "var(--muted-fg)" }}
          >
            Close
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          {paymentOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setPaymentType(opt.type)}
              className="flex-1 py-2.5 rounded-2xl text-xs font-bold"
              style={{
                backgroundColor:
                  paymentType === opt.type
                    ? "var(--accent-color)"
                    : "var(--muted)",
                color:
                  paymentType === opt.type ? "white" : "var(--muted-fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {paymentType === "cash" && (
          <div className="space-y-2 mb-3">
            <label
              className="block text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted-fg)" }}
            >
              Cash tendered
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              className="w-full rounded-2xl px-3 py-2 text-base font-mono focus:outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
            {change >= 0 && (
              <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                Change:{" "}
                <span className="font-mono" style={{ color: "var(--fg)" }}>
                  {formatCurrency(change)}
                </span>
              </p>
            )}
            {change < 0 && (
              <p className="text-xs" style={{ color: "#ef4444" }}>
                Short by {formatCurrency(-change)}
              </p>
            )}
          </div>
        )}

        <div
          className="rounded-2xl p-3 text-[11px] mb-3"
          style={{
            backgroundColor: "rgba(245,158,11,0.1)",
            color: "#b45309",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          This order will be queued and synced when the network returns.
          A BIR-compliant receipt prints with a pre-allocated OR number.
        </div>

        {error && (
          <div
            className="rounded-2xl p-3 text-xs mb-3"
            style={{
              backgroundColor: "rgba(239,68,68,0.1)",
              color: "#b91c1c",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!canPay || isProcessing}
          className="w-full py-3 rounded-2xl text-sm font-bold disabled:opacity-40"
          style={{
            backgroundColor: "var(--accent-color)",
            color: "white",
          }}
        >
          {isProcessing ? "Saving…" : "Confirm payment"}
        </button>
      </div>
    </div>
  );
}
