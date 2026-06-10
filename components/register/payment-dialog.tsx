"use client";

import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { CashTenderModal } from "./cash-tender-modal";
import { useOfflineMutation } from "@/lib/offline/use-offline-mutation";

type PaymentType = "cash" | "card" | "ewallet";

type SplitPayment = {
  type: PaymentType;
  amount: number;
  tendered?: number;
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
  const completeOrder = useOfflineMutation(api.orders.mutations.completeOrder, {
    fnPath: "orders/mutations:completeOrder",
  });

  // When queued offline, the server has not assigned a BIR serial / order
  // number yet. We hand the receipt path a placeholder so the cashier
  // still gets a printable copy; once the queue flushes, the real number
  // is recorded on the order document and the operator can re-print.
  const handleCompleted = (
    result:
      | { queued: false; result: { orderNumber: string } }
      | { queued: true; optimisticId: string }
  ) => {
    if (result.queued) {
      onCompleted(`OFFLINE-${result.optimisticId.slice(0, 8).toUpperCase()}`);
    } else {
      onCompleted(result.result.orderNumber);
    }
  };

  const [mode, setMode] = useState<"select" | "split">("select");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PaymentType | null>(null);
  const [pendingSplit, setPendingSplit] = useState(false);
  const [showTender, setShowTender] = useState(false);

  // Split payment state
  const [splits, setSplits] = useState<SplitPayment[]>([
    { type: "cash", amount: 0 },
    { type: "ewallet", amount: 0 },
  ]);
  const [splitInputs, setSplitInputs] = useState<string[]>(["", ""]);
  const [splitTenderInputs, setSplitTenderInputs] = useState<string[]>(["", ""]);

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const splitRemaining = orderTotal - splitTotal;

  // Step 1: Select payment type → cash opens tender modal, others show confirm
  const handleSelectPayment = (paymentType: PaymentType) => {
    if (paymentType === "cash") {
      setShowTender(true);
      return;
    }
    setPendingPayment(paymentType);
  };

  // Step 2: Confirmed → process payment (card / ewallet)
  const handleConfirmedPayment = async () => {
    if (!token || isProcessing || !pendingPayment) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await completeOrder({
        token,
        orderId,
        paymentType: pendingPayment,
      });
      handleCompleted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setIsProcessing(false);
      setPendingPayment(null);
    }
  };

  // Cash tender confirmed → process payment with tendered amount
  const handleCashTendered = async (tenderedCents: number) => {
    if (!token || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await completeOrder({
        token,
        orderId,
        paymentType: "cash",
        cashTendered: tenderedCents,
      });
      handleCompleted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setIsProcessing(false);
      setShowTender(false);
    }
  };

  // Split payment — validate then show confirm
  const handleSplitPaymentClick = () => {
    const activeSplits = splits.filter((s) => s.amount > 0);
    if (activeSplits.length < 2) {
      setError("Split payment needs at least 2 payment methods");
      return;
    }
    if (Math.abs(splitRemaining) > 1) {
      setError("Amounts must add up to the total");
      return;
    }
    setPendingSplit(true);
  };

  const handleConfirmedSplitPayment = async () => {
    if (!token || isProcessing) return;

    const activeSplits = splits.filter((s) => s.amount > 0);
    // Validate cash rows have sufficient tender (if a tender was entered)
    for (const s of activeSplits) {
      if (s.type === "cash" && s.tendered !== undefined && s.tendered < s.amount) {
        setError("Cash tendered is less than the cash portion");
        return;
      }
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
      handleCompleted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setIsProcessing(false);
      setPendingSplit(false);
    }
  };

  const updateSplitAmount = (index: number, value: string) => {
    setSplitInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
    const parsed = parseFloat(value || "0");
    const amount = isNaN(parsed) ? 0 : Math.round(parsed * 100);
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, amount } : s)));
  };

  const updateSplitType = (index: number, type: PaymentType) => {
    setSplits((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, type, tendered: type === "cash" ? s.tendered : undefined } : s
      )
    );
    if (type !== "cash") {
      setSplitTenderInputs((prev) => prev.map((v, i) => (i === index ? "" : v)));
    }
  };

  const updateSplitTender = (index: number, value: string) => {
    setSplitTenderInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
    const parsed = parseFloat(value || "0");
    const tendered = isNaN(parsed) ? 0 : Math.round(parsed * 100);
    setSplits((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, tendered: tendered > 0 ? tendered : undefined } : s
      )
    );
  };

  const addSplit = () => {
    setSplits((prev) => [...prev, { type: "card", amount: 0 }]);
    setSplitInputs((prev) => [...prev, ""]);
    setSplitTenderInputs((prev) => [...prev, ""]);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return;
    setSplits((prev) => prev.filter((_, i) => i !== index));
    setSplitInputs((prev) => prev.filter((_, i) => i !== index));
    setSplitTenderInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const fillRemaining = (index: number) => {
    const othersTotal = splits.reduce((sum, s, i) => (i === index ? sum : sum + s.amount), 0);
    const remaining = orderTotal - othersTotal;
    if (remaining > 0) {
      const displayVal = (remaining / 100).toFixed(2);
      setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, amount: remaining } : s)));
      setSplitInputs((prev) => prev.map((v, i) => (i === index ? displayVal : v)));
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isProcessing) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
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
            aria-label="Close payment dialog"
            className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl font-bold transition-colors disabled:opacity-40 active:scale-95"
            style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
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
                  onClick={() => handleSelectPayment(option.type)}
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

            {/* Split payment option + cancel */}
            <div className="px-6 pb-6 flex flex-col gap-3">
              <button
                onClick={() => setMode("split")}
                disabled={isProcessing}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Split Payment
              </button>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="w-full py-4 rounded-2xl text-base font-bold transition-colors disabled:opacity-40 active:scale-[0.99]"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Split payment form */}
            <div className="p-6 space-y-4">
              {splits.map((split, index) => {
                const tendered = split.tendered ?? 0;
                const change = split.type === "cash" && tendered > 0 ? tendered - split.amount : null;
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-3">
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

                      <div className="flex-1 flex gap-2 items-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={splitInputs[index] ?? ""}
                          onChange={(e) => updateSplitAmount(index, e.target.value.replace(/[^0-9.]/g, ""))}
                          className="w-full rounded-2xl px-3 py-3 text-sm text-right"
                          style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                          placeholder="0.00"
                        />
                        <button
                          onClick={() => fillRemaining(index)}
                          className="shrink-0 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                          style={{ backgroundColor: "var(--accent-color)", color: "white" }}
                        >
                          Fill
                        </button>
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

                    {/* Tender input only for cash rows with an amount */}
                    {split.type === "cash" && split.amount > 0 && (
                      <div className="ml-2 flex items-center gap-3 pl-3" style={{ borderLeft: "2px solid var(--border-color)" }}>
                        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--muted-fg)" }}>
                          Tendered
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={splitTenderInputs[index] ?? ""}
                          onChange={(e) => updateSplitTender(index, e.target.value.replace(/[^0-9.]/g, ""))}
                          className="flex-1 rounded-xl px-3 py-2 text-sm text-right font-mono"
                          style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                          placeholder="0.00"
                        />
                        {change !== null && tendered > 0 && (
                          <span
                            className="text-xs font-mono font-semibold whitespace-nowrap"
                            style={{
                              color: change < 0 ? "#ef4444" : "var(--accent-color)",
                            }}
                          >
                            {change < 0
                              ? `Short ${formatCurrency(-change)}`
                              : `Change ${formatCurrency(change)}`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

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
                onClick={handleSplitPaymentClick}
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

      {/* Confirm single payment */}
      <ConfirmModal
        open={!!pendingPayment}
        title="Confirm Payment"
        message={`Complete this order for ${formatCurrency(orderTotal)} via ${pendingPayment === "ewallet" ? "E-Wallet" : pendingPayment === "card" ? "Card" : "Cash"}?`}
        confirmLabel="Confirm Payment"
        cancelLabel="Go Back"
        onConfirm={handleConfirmedPayment}
        onCancel={() => setPendingPayment(null)}
      />

      {/* Confirm split payment */}
      <ConfirmModal
        open={pendingSplit}
        title="Confirm Split Payment"
        message={`Complete this split payment of ${formatCurrency(orderTotal)}?`}
        confirmLabel="Confirm Payment"
        cancelLabel="Go Back"
        onConfirm={handleConfirmedSplitPayment}
        onCancel={() => setPendingSplit(false)}
      />

      {/* Cash tender modal */}
      {showTender && (
        <CashTenderModal
          totalDue={orderTotal}
          onConfirm={handleCashTendered}
          onCancel={() => setShowTender(false)}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
