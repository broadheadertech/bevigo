"use client";

import { useEffect, useState } from "react";
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
  customerLabel?: string;
  modifiers: OrderModifier[];
};

type OrderData = {
  _id: Id<"orders">;
  subtotal: number;
  taxAmount: number;
  total: number;
  taxLabel: string;
  items: OrderItem[];
  customerLabel?: string;
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  discountAmount?: number;
  discountReason?: string;
};

type OrderPanelProps = {
  order: OrderData | null;
  /** Universal name resolved from order.customerLabel or linked customer */
  inheritedName?: string;
  onRemoveItem: (orderItemId: Id<"orderItems">) => void;
  onEditItem?: (item: OrderItem) => void;
  onComplete: () => void;
  onAddDiscount?: () => void;
  onRemoveDiscount?: () => void;
  onSetItemLabel?: (orderItemId: Id<"orderItems">, label: string) => Promise<void> | void;
  onSetOrderLabel?: (label: string) => Promise<void> | void;
  onPrintLabels?: () => void;
  isLoading: boolean;
};

export function OrderPanel({
  order,
  inheritedName,
  onRemoveItem,
  onEditItem,
  onComplete,
  onAddDiscount,
  onRemoveDiscount,
  onSetItemLabel,
  onSetOrderLabel,
  onPrintLabels,
  isLoading,
}: OrderPanelProps) {
  const items = order?.items ?? [];
  const hasItems = items.length > 0;
  const [editingLabelId, setEditingLabelId] = useState<Id<"orderItems"> | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [orderLabelDraft, setOrderLabelDraft] = useState(order?.customerLabel ?? "");
  const [orderLabelFocused, setOrderLabelFocused] = useState(false);

  // Sync the order label draft when the order's customerLabel changes from elsewhere
  useEffect(() => {
    if (!orderLabelFocused) {
      setOrderLabelDraft(order?.customerLabel ?? "");
    }
  }, [order?.customerLabel, orderLabelFocused]);

  const universal = order?.customerLabel?.trim() || inheritedName?.trim() || "";

  const startEditLabel = (item: OrderItem) => {
    setEditingLabelId(item._id);
    setLabelDraft(item.customerLabel ?? "");
  };
  const commitLabel = async (item: OrderItem) => {
    if (!onSetItemLabel) return;
    const trimmed = labelDraft.trim();
    if (trimmed === (item.customerLabel ?? "")) {
      setEditingLabelId(null);
      return;
    }
    await onSetItemLabel(item._id, trimmed);
    setEditingLabelId(null);
  };

  const commitOrderLabel = async () => {
    if (!onSetOrderLabel) return;
    const trimmed = orderLabelDraft.trim();
    if (trimmed === (order?.customerLabel ?? "")) return;
    await onSetOrderLabel(trimmed);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ backgroundColor: 'var(--card)', color: 'var(--card-fg)', borderLeft: '1px solid var(--border-color)' }}>
      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--muted)' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>
          Current Order
        </h2>
        {hasItems && (
          <p className="text-xs mt-0.5">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Universal name (applies to all stickers unless a line overrides) */}
      {hasItems && onSetOrderLabel && (
        <div className="px-4 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <label
            htmlFor="order-label-input"
            className="block text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'var(--muted-fg)' }}
          >
            Customer name (all cups)
          </label>
          <input
            id="order-label-input"
            type="text"
            value={orderLabelDraft}
            maxLength={40}
            placeholder={inheritedName ?? "e.g. John"}
            onChange={(e) => setOrderLabelDraft(e.target.value)}
            onFocus={() => setOrderLabelFocused(true)}
            onBlur={() => {
              setOrderLabelFocused(false);
              commitOrderLabel();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full text-sm rounded-md px-2 py-1.5"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
          />
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
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
                  {/* Customer name (inline-editable). Inherits universal name when not overridden. */}
                  {onSetItemLabel && (
                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                      {editingLabelId === item._id ? (
                        <input
                          type="text"
                          autoFocus
                          value={labelDraft}
                          maxLength={40}
                          onChange={(e) => setLabelDraft(e.target.value)}
                          onBlur={() => commitLabel(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitLabel(item);
                            } else if (e.key === "Escape") {
                              setEditingLabelId(null);
                            }
                          }}
                          placeholder={universal || "Customer name"}
                          className="w-full text-xs rounded-md px-2 py-1"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--accent-color)' }}
                        />
                      ) : item.customerLabel ? (
                        <button
                          onClick={() => startEditLabel(item)}
                          className="text-xs font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
                          title="Tap to edit name (override)"
                        >
                          {item.customerLabel}
                          <span className="opacity-60 text-[9px]">override</span>
                        </button>
                      ) : universal ? (
                        <button
                          onClick={() => startEditLabel(item)}
                          className="text-xs inline-flex items-center gap-1"
                          style={{ color: 'var(--muted-fg)' }}
                          title="Inherits the universal name. Tap to override for this cup."
                        >
                          <span>{universal}</span>
                          <span className="opacity-50 text-[9px]">(default — tap to override)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => startEditLabel(item)}
                          className="text-xs"
                          style={{ color: 'var(--muted-fg)' }}
                          title="Add customer name"
                        >
                          + Name
                        </button>
                      )}
                    </div>
                  )}
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
        <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--muted)' }}>
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
          {onPrintLabels && (
            <button
              onClick={onPrintLabels}
              disabled={isLoading}
              className="w-full py-2.5 mb-2 text-sm font-semibold rounded-2xl"
              style={{ border: '1px solid var(--border-color)', color: 'var(--fg)' }}
            >
              Print Labels
            </button>
          )}
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
