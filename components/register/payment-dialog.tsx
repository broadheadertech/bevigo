"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type PaymentType = "cash" | "card" | "ewallet";

type PaymentDialogProps = {
  orderId: Id<"orders">;
  orderTotal: number;
  onClose: () => void;
  onCompleted: (orderNumber: string) => void;
};

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async (paymentType: PaymentType) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Select Payment
          </h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-stone-400 hover:text-stone-600 text-xl leading-none p-1 disabled:opacity-50"
          >
            &#10005;
          </button>
        </div>

        {/* Total */}
        <div className="px-6 py-4 text-center border-b border-stone-100 dark:border-stone-800">
          <p className="text-sm text-stone-500">Total Due</p>
          <p className="text-3xl font-bold text-stone-900 mt-1">
            {formatPrice(orderTotal)}
          </p>
        </div>

        {/* Payment buttons */}
        <div className="p-6 grid grid-cols-3 gap-4">
          {paymentOptions.map((option) => (
            <button
              key={option.type}
              onClick={() => handlePayment(option.type)}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center gap-2 min-h-[80px] min-w-[80px] rounded-xl border-2 border-stone-200 bg-stone-50 dark:bg-stone-800 hover:border-green-500 hover:bg-green-50 active:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-4"
            >
              <span className="text-3xl" role="img" aria-label={option.label}>
                {option.icon}
              </span>
              <span className="text-sm font-medium text-stone-700">
                {option.label}
              </span>
            </button>
          ))}
        </div>

        {/* Loading / Error */}
        {isProcessing && (
          <div className="px-6 pb-4 text-center">
            <p className="text-sm text-stone-500">Processing payment...</p>
          </div>
        )}
        {error && (
          <div className="px-6 pb-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
