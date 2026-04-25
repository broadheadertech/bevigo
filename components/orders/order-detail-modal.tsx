"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { ReceiptView } from "@/components/register/receipt-view";
import { StickerView } from "@/components/register/sticker-view";

type OrderDetailModalProps = {
  orderId: Id<"orders">;
  onClose: () => void;
  onRefund?: () => void;
  canRefund?: boolean;
};

type Modifier = { _id: string; modifierName: string; priceAdjustment: number };
type Item = { _id: string; itemName: string; basePrice: number; quantity: number; subtotal: number; modifiers: Modifier[] };
type OrderData = {
  _id: string;
  orderNumber?: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  taxLabel: string;
  taxRate: number;
  total: number;
  paymentType?: string;
  payments?: Array<{ type: string; amount: number }>;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  discountReason?: string;
  refundedAt?: number;
  refundReason?: string;
  refundAmount?: number;
  customerId?: string;
  tableName?: string;
  completedAt?: number;
  _creationTime: number;
  items: Item[];
};

export function OrderDetailModal({ orderId, onClose, onRefund, canRefund }: OrderDetailModalProps) {
  const { token } = useAuth();
  const [showReprintReceipt, setShowReprintReceipt] = useState(false);
  const [showReprintStickers, setShowReprintStickers] = useState(false);

  const order = useQuery(
    api.orders.queries.getOrderWithItems,
    token ? { token, orderId } : "skip"
  ) as OrderData | null | undefined;

  // Get location + barista info via receipt query
  const receipt = useQuery(
    api.orders.queries.getReceipt,
    token ? { token, orderId } : "skip"
  ) as { locationName: string; baristaName: string; orderNumber: string; completedAt: number; paymentType: string } | null | undefined;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const showRefundBtn = canRefund && order?.status === "completed" && !order?.refundedAt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div>
            <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              {receipt?.orderNumber || order?.orderNumber || "Order Details"}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              {order?.completedAt ? formatDate(order.completedAt) : order?._creationTime ? formatDate(order._creationTime) : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl font-bold transition-colors active:scale-95"
            style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
          >
            &#10005;
          </button>
        </div>

        {!order ? (
          <div className="p-8 text-center" style={{ color: "var(--muted-fg)" }}>Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Status + Meta */}
            <div className="px-6 py-4 flex flex-wrap gap-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
              {/* Status badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                order.refundedAt ? "bg-amber-500/10 text-amber-400"
                : order.status === "completed" ? "bg-emerald-500/10 text-emerald-400"
                : order.status === "voided" ? "bg-red-500/10 text-red-400"
                : "bg-stone-500/10 text-stone-400"
              }`}>
                {order.refundedAt ? "Refunded" : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>

              {/* Payment type */}
              {order.paymentType && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400">
                  {order.paymentType === "ewallet" ? "E-Wallet" : order.paymentType === "split" ? "Split" : order.paymentType.charAt(0).toUpperCase() + order.paymentType.slice(1)}
                </span>
              )}

              {/* Location + Barista */}
              {receipt && (
                <>
                  <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>
                    {receipt.locationName}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>
                    Barista: {receipt.baristaName}
                  </span>
                </>
              )}

              {order.tableName && (
                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>
                  {order.tableName}
                </span>
              )}
            </div>

            {/* Items */}
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <h4 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted-fg)" }}>Items</h4>
              <div className="space-y-3">
                {order.items.map((item: Item) => (
                  <div key={item._id} className="flex justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                        {item.quantity > 1 && <span style={{ color: "var(--muted-fg)" }}>{item.quantity}x </span>}
                        {item.itemName}
                      </p>
                      {item.modifiers.length > 0 && (
                        <div className="mt-0.5">
                          {item.modifiers.map((mod: Modifier) => (
                            <span key={mod._id} className="text-xs mr-2" style={{ color: "var(--muted-fg)" }}>
                              + {mod.modifierName}
                              {mod.priceAdjustment > 0 && ` (${formatCurrency(mod.priceAdjustment)})`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium shrink-0 ml-4" style={{ color: "var(--fg)" }}>
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="px-6 py-4 space-y-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex justify-between text-sm" style={{ color: "var(--muted-fg)" }}>
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discountAmount != null && order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--muted-fg)" }}>
                    Discount{order.discountType === "percentage" ? ` (${order.discountValue}%)` : ""}
                    {order.discountReason && <span className="ml-1 text-xs">— {order.discountReason}</span>}
                  </span>
                  <span className="text-red-400 font-medium">-{formatCurrency(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm" style={{ color: "var(--muted-fg)" }}>
                <span>{order.taxLabel}</span>
                <span>{formatCurrency(order.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2" style={{ color: "var(--fg)", borderTop: "1px solid var(--border-color)" }}>
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {/* Split payment breakdown */}
            {order.payments && order.payments.length > 0 && (
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <h4 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>Payment Breakdown</h4>
                {order.payments.map((p: { type: string; amount: number }, i: number) => (
                  <div key={i} className="flex justify-between text-sm" style={{ color: "var(--muted-fg)" }}>
                    <span>{p.type === "ewallet" ? "E-Wallet" : p.type.charAt(0).toUpperCase() + p.type.slice(1)}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Refund info */}
            {order.refundedAt && (
              <div className="px-6 py-4 bg-amber-500/5" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <h4 className="text-xs font-semibold uppercase tracking-widest mb-2 text-amber-400">Refund Details</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted-fg)" }}>Amount</span>
                    <span className="text-red-400 font-semibold">{formatCurrency(order.refundAmount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted-fg)" }}>Reason</span>
                    <span style={{ color: "var(--fg)" }}>{order.refundReason || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted-fg)" }}>Date</span>
                    <span style={{ color: "var(--fg)" }}>{formatDate(order.refundedAt)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 flex flex-col gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-color)" }}>
          {showRefundBtn && onRefund && (
            <button
              onClick={onRefund}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors"
            >
              Refund Order
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onClose}
              className="flex-1 min-w-24 px-4 py-3 rounded-2xl text-sm font-medium transition-colors"
              style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
            >
              Close
            </button>
            {order?.status === "completed" && (
              <>
                <button
                  onClick={() => setShowReprintReceipt(true)}
                  className="flex-1 min-w-32 px-4 py-3 rounded-2xl text-sm font-medium"
                  style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
                >
                  Reprint Receipt
                </button>
                <button
                  onClick={() => setShowReprintStickers(true)}
                  className="flex-1 min-w-32 px-4 py-3 rounded-2xl text-sm font-medium"
                  style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
                >
                  Reprint Stickers
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showReprintReceipt && token && (
        <ReceiptView
          orderId={orderId}
          token={token}
          onClose={() => setShowReprintReceipt(false)}
        />
      )}

      {showReprintStickers && token && (
        <StickerView
          orderId={orderId}
          token={token}
          onClose={() => setShowReprintStickers(false)}
        />
      )}
    </div>
  );
}
