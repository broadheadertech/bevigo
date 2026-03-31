"use client";

import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type OrderModifier = {
  _id: Id<"orderItemModifiers">;
  modifierName: string;
  priceAdjustment: number;
};

type OrderItem = {
  _id: Id<"orderItems">;
  itemName: string;
  basePrice: number;
  quantity: number;
  subtotal: number;
  modifiers: OrderModifier[];
};

type OrderData = {
  _id: Id<"orders">;
  subtotal: number;
  taxAmount: number;
  total: number;
  taxLabel: string;
  items: OrderItem[];
};

type OrderPanelProps = {
  order: OrderData | null;
  onRemoveItem: (orderItemId: Id<"orderItems">) => void;
  onEditItem?: (item: OrderItem) => void;
  onComplete: () => void;
  isLoading: boolean;
};

export function OrderPanel({
  order,
  onRemoveItem,
  onEditItem,
  onComplete,
  isLoading,
}: OrderPanelProps) {
  const items = order?.items ?? [];
  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col h-full bg-white border-l border-stone-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
          Current Order
        </h2>
        {hasItems && (
          <p className="text-xs text-stone-400 mt-0.5">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-stone-400 text-sm">Tap an item to start</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {items.map((item: OrderItem) => (
              <div
                key={item._id}
                className="px-4 py-3 flex items-start gap-2 group cursor-pointer hover:bg-stone-50 active:bg-stone-100 transition-colors"
                onClick={() => onEditItem?.(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEditItem?.(item);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-900 truncate">
                      {item.quantity > 1 && (
                        <span className="text-stone-500 mr-1">
                          {item.quantity}x
                        </span>
                      )}
                      {item.itemName}
                    </span>
                    <span className="text-sm font-medium text-stone-700 ml-2 flex-shrink-0">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                  {item.modifiers.length > 0 && (
                    <div className="mt-0.5">
                      {item.modifiers.map((mod: OrderModifier) => (
                        <span
                          key={mod._id}
                          className="text-xs text-stone-500 mr-2"
                        >
                          + {mod.modifierName}
                          {mod.priceAdjustment > 0 &&
                            ` (+${formatCurrency(mod.priceAdjustment)})`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(item._id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs p-1 transition-opacity flex-shrink-0"
                  title="Remove item"
                >
                  &#10005;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals + actions */}
      {hasItems && order && (
        <div className="border-t border-stone-200 px-4 py-3 bg-stone-50">
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-sm text-stone-600">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-600">
              <span>{order.taxLabel}</span>
              <span>{formatCurrency(order.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-stone-900 pt-1 border-t border-stone-200">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
          <button
            onClick={onComplete}
            disabled={isLoading}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors min-h-[48px]"
          >
            {isLoading ? "Processing..." : "Complete Order"}
          </button>
        </div>
      )}
    </div>
  );
}
