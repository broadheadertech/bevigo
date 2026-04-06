"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type PaymentType = "cash" | "card" | "ewallet";

type SplitPayment = {
  type: PaymentType;
  amount: number;
};

type PaymentDialogProps = {
  orderId: Id<"orders">;
  orderTotal: number;
  onClose: () => void;
  onCompleted: (orderNumber: string) => void;
};

const paymentOptions: { type: PaymentType; label: string; icon: string }[] = [
  { type: "cash", label: "Cash", icon: "\u{1F4B5}" },
  { type: "card", label: "Card", icon: "\u{1F4B3}" },
  { type: "ewallet", label: "E-Wallet", icon: "\u{1F4F1}" },
];

export function PaymentDialog({
  orderId,
  orderTotal,
  onClose,
  onCompleted,
}: PaymentDialogProps) {
  const { token } = useAuth();
  const completeOrder = useMutation(api.orders.mutations.completeOrder);

  const [mode, setMode] = useState<"select" | "split">("select");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Split payment state
  const [splits, setSplits] = useState<SplitPayment[]>([
    { type: "cash", amount: 0 },
    { type: "ewallet", amount: 0 },
  ]);

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const splitRemaining = orderTotal - splitTotal;

  // Full payment with single type
  const handleFullPayment = async (paymentType: PaymentType) => {
    if (!token || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await completeOrder({
        token,
        orderId,
        paymentType,
      });
      onCompleted(result.orderNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setIsProcessing(false);
    }
  };

  // Split payment
  const handleSplitPayment = async () => {
    if (!token || isProcessing) return;

    const activeSplits = splits.filter((s) => s.amount > 0);
    if (activeSplits.length < 2) {
      setError("Split payment needs at least 2 payment methods");
      return;
    }
    if (Math.abs(splitRemaining) > 1) {
      setError("Amounts must add up to the total");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const result = await completeOrder({
        token,
        orderId,
        paymentType: "split",
        payments: activeSplits,
      });
      onCompleted(result.orderNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setIsProcessing(false);
    }
  };

  const updateSplitAmount = (index: number, value: string) => {
    const amount = Math.round(parseFloat(value || "0") * 100);
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, amount: isNaN(amount) ? 0 : amount } : s)));
  };

  const updateSplitType = (index: number, type: PaymentType) => {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, type } : s)));
  };

  const addSplit = () => {
    setSplits((prev) => [...prev, { type: "card", amount: 0 }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return;
    setSplits((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-fill remaining on last split
  const fillRemaining = (index: number) => {
    const othersTotal = splits.reduce((sum, s, i) => (i === index ? sum : sum + s.amount), 0);
    const remaining = orderTotal - othersTotal;
    if (remaining > 0) {
      setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, amount: remaining } : s)));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            {mode === "select" ? "Payment" : "Split Payment"}
          </h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        {/* Total */}
        <div className="px-6 py-5 text-center" style={{ backgroundColor: "var(--muted)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted-fg)" }}>
            Total Due
          </p>
          <p className="text-3xl font-bold" style={{ color: "var(--fg)" }}>
            {formatCurrency(orderTotal)}
          </p>
        </div>

        {mode === "select" ? (
          <>
            {/* Full payment buttons */}
            <div className="p-6 grid grid-cols-3 gap-3">
              {paymentOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleFullPayment(option.type)}
                  disabled={isProcessing}
                  className="flex flex-col items-center justify-center gap-2 min-h-[90px] rounded-2xl transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}
                >
                  <span className="text-3xl">{option.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Split payment option */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setMode("split")}
                disabled={isProcessing}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Split Payment
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Split payment form */}
            <div className="p-6 space-y-4">
              {splits.map((split, index) => (
                <div key={index} className="flex items-center gap-3">
                  <select
                    value={split.type}
                    onChange={(e) => updateSplitType(index, e.target.value as PaymentType)}
                    className="rounded-2xl px-3 py-3 text-sm flex-1"
                    style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                  >
                    {paymentOptions.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={split.amount > 0 ? (split.amount / 100).toFixed(2) : ""}
                      onChange={(e) => updateSplitAmount(index, e.target.value)}
                      className="w-full rounded-2xl px-3 py-3 text-sm text-right"
                      style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                      placeholder="0.00"
                    />
                    {split.amount === 0 && (
                      <button
                        onClick={() => fillRemaining(index)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-1 rounded-xl"
                        style={{ backgroundColor: "var(--accent-color)", color: "white" }}
                      >
                        Fill
                      </button>
                    )}
                  </div>

                  {splits.length > 2 && (
                    <button
                      onClick={() => removeSplit(index)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                    >
                      &#10005;
                    </button>
                  )}
                </div>
              ))}

              {splits.length < 4 && (
                <button
                  onClick={addSplit}
                  className="w-full py-2 rounded-2xl text-xs font-medium border border-dashed transition-colors"
                  style={{ borderColor: "var(--border-color)", color: "var(--muted-fg)" }}
                >
                  + Add Payment Method
                </button>
              )}

              {/* Remaining indicator */}
              <div className="flex justify-between items-center pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--muted-fg)" }}>Remaining</span>
                <span
                  className="text-lg font-bold"
                  style={{ color: Math.abs(splitRemaining) <= 1 ? "var(--accent-color)" : "#ef4444" }}
                >
                  {formatCurrency(Math.max(0, splitRemaining))}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setMode("select")}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-2xl text-sm font-medium transition-colors"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Back
              </button>
              <button
                onClick={handleSplitPayment}
                disabled={isProcessing || Math.abs(splitRemaining) > 1}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                style={{ backgroundColor: "var(--accent-color)" }}
              >
                {isProcessing ? "Processing..." : "Complete Split Payment"}
              </button>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="px-6 pb-4">
            <p className="text-sm text-center p-3 rounded-2xl bg-red-500/10 text-red-400">{error}</p>
          </div>
        )}

        {isProcessing && mode === "select" && (
          <div className="px-6 pb-4 text-center">
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>Processing payment...</p>
          </div>
        )}
      </div>
    </div>
  );
}
