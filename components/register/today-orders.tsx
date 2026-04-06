"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { OrderDetailModal } from "@/components/orders/order-detail-modal";
import { RefundDialog } from "@/components/orders/refund-dialog";
import { useState } from "react";

type TodayOrdersProps = {
  locationId: Id<"locations">;
  onClose: () => void;
};

type HistoryOrder = {
  _id: Id<"orders">;
  orderNumber: string;
  completedAt: number;
  total: number;
  paymentType: string;
  itemCount: number;
  status: string;
  baristaName: string;
  customerName: string | null;
  refundedAt: number | null;
  refundAmount: number | null;
};

export function TodayOrders({ locationId, onClose }: TodayOrdersProps) {
  const { token, session } = useAuth();
  const [viewOrderId, setViewOrderId] = useState<Id<"orders"> | null>(null);
  const [refundTarget, setRefundTarget] = useState<{
    orderId: Id<"orders">;
    orderTotal: number;
    orderNumber: string;
  } | null>(null);

  const [search, setSearch] = useState("");
  const canRefund = session?.role === "owner" || session?.role === "manager";

  // Today's date range
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  const orders = useQuery(
    api.orders.historyQueries.listOrderHistory,
    token
      ? {
          token,
          locationId,
          startDate: startOfDay,
          endDate: endOfDay,
          limit: 50,
        }
      : "skip"
  ) as HistoryOrder[] | undefined;

  const allCompleted = (orders ?? []).filter(
    (o: HistoryOrder) => o.status === "completed" || o.status === "voided"
  );

  // Filter by search
  const completedOrders = search.trim()
    ? allCompleted.filter((o: HistoryOrder) => {
        const q = search.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          o.baristaName.toLowerCase().includes(q)
        );
      })
    : allCompleted;

  const totalRevenue = allCompleted
    .filter((o: HistoryOrder) => o.status === "completed" && !o.refundedAt)
    .reduce((sum: number, o: HistoryOrder) => sum + o.total, 0);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Panel */}
        <div
          className="relative w-full max-w-md h-full flex flex-col"
          style={{ backgroundColor: "var(--card)" }}
        >
          {/* Header */}
          <div className="shrink-0">
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border-color)" }}
            >
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
                  Today&apos;s Orders
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {allCompleted.length} orders
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--accent-color)" }}>
                    {formatCurrency(totalRevenue)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl"
              style={{ color: "var(--muted-fg)" }}
            >
              &#10005;
            </button>
            </div>

            {/* Search bar */}
            <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by order #, customer, or barista..."
                className="w-full px-4 py-2.5 rounded-2xl text-sm outline-none"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              />
            </div>
          </div>

          {/* Orders list */}
          <div className="flex-1 overflow-y-auto">
            {completedOrders.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
                  No orders yet today
                </p>
              </div>
            ) : (
              <div>
                {completedOrders.map((order: HistoryOrder) => (
                  <button
                    key={order._id}
                    onClick={() => setViewOrderId(order._id)}
                    className="w-full text-left px-5 py-3 transition-colors hover:opacity-80"
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                              {order.orderNumber}
                            </p>
                            {order.customerName && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-color)", color: "white" }}>
                                {order.customerName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                            {formatTime(order.completedAt)} · {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                            {!order.customerName && " · Walk-in"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                          {formatCurrency(order.total)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              order.refundedAt
                                ? "bg-amber-500/10 text-amber-400"
                                : order.status === "voided"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {order.refundedAt ? "Refunded" : order.status === "voided" ? "Voided" : "Paid"}
                          </span>
                          <span className="text-[10px] capitalize" style={{ color: "var(--muted-fg)" }}>
                            {order.paymentType === "ewallet" ? "E-Wallet" : order.paymentType}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order detail modal */}
      {viewOrderId && (
        <OrderDetailModal
          orderId={viewOrderId}
          onClose={() => setViewOrderId(null)}
          canRefund={canRefund}
          onRefund={() => {
            const order = completedOrders.find((o: HistoryOrder) => o._id === viewOrderId);
            if (order) {
              setViewOrderId(null);
              setRefundTarget({
                orderId: order._id,
                orderTotal: order.total,
                orderNumber: order.orderNumber,
              });
            }
          }}
        />
      )}

      {/* Refund dialog */}
      {refundTarget && (
        <RefundDialog
          orderId={refundTarget.orderId}
          orderTotal={refundTarget.orderTotal}
          orderNumber={refundTarget.orderNumber}
          onClose={() => setRefundTarget(null)}
          onRefunded={() => setRefundTarget(null)}
        />
      )}
    </>
  );
}
