"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/currency";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type RefundDialogProps = {
  orderId: Id<"orders">;
  orderTotal: number;
  orderNumber: string;
  onClose: () => void;
  onRefunded: () => void;
};

const REFUND_REASONS = [
  "Customer complaint",
  "Wrong order",
  "Quality issue",
  "Overcharge",
  "Custom",
] as const;

export function RefundDialog({
  orderId,
  orderTotal,
  orderNumber,
  onClose,
  onRefunded,
}: RefundDialogProps) {
  const { token } = useAuth();
  const refundOrder = useMutation(api.orders.mutations.refundOrder);

  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [amountStr, setAmountStr] = useState("");
  const [reasonSelect, setReasonSelect] = useState<string>(REFUND_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundAmount =
    refundType === "full"
      ? orderTotal
      : Math.round(parseFloat(amountStr || "0") * 100);

  const reason = reasonSelect === "Custom" ? customReason : reasonSelect;

  const isValid =
    refundAmount > 0 &&
    refundAmount <= orderTotal &&
    reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!token || !isValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await refundOrder({
        token,
        orderId,
        refundAmount,
        refundReason: reason,
      });
      onRefunded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div
          className="rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <h3
            className="text-lg font-bold mb-1"
            style={{ color: "var(--fg)" }}
          >
            Refund Order
          </h3>
          <p className="text-sm mb-6" style={{ color: "var(--muted-fg)" }}>
            {orderNumber}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Refund Type Toggle */}
          <div className="mb-5">
            <label
              className="block text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: "var(--muted-fg)" }}
            >
              Refund Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRefundType("full")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  refundType === "full"
                    ? "bg-amber-500 text-white"
                    : ""
                }`}
                style={
                  refundType !== "full"
                    ? {
                        border: "1px solid var(--border-color)",
                        color: "var(--fg)",
                      }
                    : undefined
                }
              >
                Full Refund
              </button>
              <button
                type="button"
                onClick={() => setRefundType("partial")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  refundType === "partial"
                    ? "bg-amber-500 text-white"
                    : ""
                }`}
                style={
                  refundType !== "partial"
                    ? {
                        border: "1px solid var(--border-color)",
                        color: "var(--fg)",
                      }
                    : undefined
                }
              >
                Partial Refund
              </button>
            </div>
          </div>

          {/* Partial Amount */}
          {refundType === "partial" && (
            <div className="mb-5">
              <label
                className="block text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: "var(--muted-fg)" }}
              >
                Refund Amount
              </label>
              <input
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder={`Max ${formatCurrency(orderTotal)}`}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--fg)",
                  border: "1px solid var(--border-color)",
                }}
              />
              {refundAmount > orderTotal && (
                <p className="text-xs text-red-400 mt-1">
                  Cannot exceed order total of {formatCurrency(orderTotal)}
                </p>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="mb-5">
            <label
              className="block text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: "var(--muted-fg)" }}
            >
              Reason
            </label>
            <select
              value={reasonSelect}
              onChange={(e) => setReasonSelect(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              {REFUND_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reasonSelect === "Custom" && (
            <div className="mb-5">
              <input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--fg)",
                  border: "1px solid var(--border-color)",
                }}
              />
            </div>
          )}

          {/* Preview */}
          {isValid && (
            <div
              className="mb-6 p-3 rounded-xl text-sm"
              style={{
                backgroundColor: "var(--muted)",
                border: "1px solid var(--border-color)",
              }}
            >
              <span style={{ color: "var(--muted-fg)" }}>Refund </span>
              <span className="font-bold text-red-400">
                {formatCurrency(refundAmount)}
              </span>
              <span style={{ color: "var(--muted-fg)" }}>
                {" "}
                for {orderNumber}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--border-color)",
                color: "var(--fg)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!isValid || isSubmitting}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#ef4444" }}
            >
              {isSubmitting ? "Processing..." : "Refund"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        title="Confirm Refund"
        message={`Process refund of ${formatCurrency(refundAmount)}?`}
        confirmLabel="Process Refund"
        variant="danger"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
