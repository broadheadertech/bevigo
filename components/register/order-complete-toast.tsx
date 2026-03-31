"use client";

import { useEffect, useRef } from "react";

type OrderCompleteToastProps = {
  orderNumber: string;
  onDismiss: () => void;
  onViewReceipt?: () => void;
};

export function OrderCompleteToast({
  orderNumber,
  onDismiss,
  onViewReceipt,
}: OrderCompleteToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
      role="status"
    >
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[320px]">
        <span className="text-lg">&#10003;</span>
        <span className="font-medium text-sm flex-1">
          Order #{orderNumber} completed!
        </span>
        {onViewReceipt && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (timerRef.current) clearTimeout(timerRef.current);
              onViewReceipt();
            }}
            className="text-xs font-semibold bg-white/20 hover:bg-white/30 active:bg-white/40 px-3 py-1 rounded transition-colors flex-shrink-0"
          >
            Receipt
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-white/70 hover:text-white text-sm leading-none flex-shrink-0"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
