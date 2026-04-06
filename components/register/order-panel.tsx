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
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  discountAmount?: number;
  discountReason?: string;
};

type OrderPanelProps = {
  order: OrderData | null;
  onRemoveItem: (orderItemId: Id<"orderItems">) => void;
  onEditItem?: (item: OrderItem) => void;
  onComplete: () => void;
  onAddDiscount?: () => void;
  onRemoveDiscount?: () => void;
  isLoading: boolean;
};

export function OrderPanel({
  order,
  onRemoveItem,
  onEditItem,
  onComplete,
  onAddDiscount,
  onRemoveDiscount,
  isLoading,
}: OrderPanelProps) {
  const items = order?.items ?? [];
  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--card)', color: 'var(--card-fg)', borderLeft: '1px solid var(--border-color)' }}>
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--muted)' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>
          Current Order
        </h2>
        {hasItems && (
          <p className="text-xs mt-0.5">
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
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {items.map((item: OrderItem) => (
              <div
                key={item._id}
                className="px-4 py-3 flex items-start gap-2 group cursor-pointer active:bg-stone-500/10 transition-colors"
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
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>
                      {item.quantity > 1 && (
                        <span className="text-stone-500 mr-1">
                          {item.quantity}x
                        </span>
                      )}
                      {item.itemName}
                    </span>
                    <span className="text-sm font-medium ml-2 shrink-0" style={{ color: 'var(--fg)' }}>
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                  {item.modifiers.length > 0 && (
                    <div className="mt-0.5">
                      {item.modifiers.map((mod: OrderModifier) => (
                        <span
                          key={mod._id}
                          className="text-xs mr-2"
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
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs p-1 transition-opacity shrink-0"
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
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--muted)' }}>
          {/* Add Discount button */}
          {!order.discountAmount && onAddDiscount && (
            <button
              onClick={onAddDiscount}
              className="w-full mb-2 py-2 text-sm font-medium rounded-2xl transition-colors flex items-center justify-center gap-1.5"
              style={{ border: '1px dashed var(--border-color)', color: 'var(--muted-fg)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
              Add Discount
            </button>
          )}
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-sm" style={{ color: 'var(--muted-fg)' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discountAmount != null && order.discountAmount > 0 && (
              <div className="flex justify-between text-sm items-center">
                <span style={{ color: 'var(--muted-fg)' }}>
                  Discount{order.discountType === "percentage" ? ` (${order.discountValue}%)` : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-red-400 font-medium">-{formatCurrency(order.discountAmount)}</span>
                  {onRemoveDiscount && (
                    <button
                      onClick={onRemoveDiscount}
                      className="text-red-400 hover:text-red-300 text-xs leading-none"
                      title="Remove discount"
                    >
                      &#10005;
                    </button>
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm" style={{ color: 'var(--muted-fg)' }}>
              <span>{order.taxLabel}</span>
              <span>{formatCurrency(order.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1" style={{ color: 'var(--fg)', borderTop: '1px solid var(--border-color)' }}>
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
          <button
            onClick={onComplete}
            disabled={isLoading}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-2xl hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors min-h-12"
          >
            {isLoading ? "Processing..." : "Complete Order"}
          </button>
        </div>
      )}
    </div>
  );
}
