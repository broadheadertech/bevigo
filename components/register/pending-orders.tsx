"use client";

import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type PendingOrder = {
  _id: Id<"orders">;
  userId: Id<"users">;
  subtotal: number;
  itemCount: number;
  _creationTime: number;
  tableName?: string;
};

type PendingOrdersProps = {
  orders: PendingOrder[];
  activeOrderId: Id<"orders"> | null;
  onSelectOrder: (orderId: Id<"orders">) => void;
  onNewOrder: () => void;
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function PendingOrders({
  orders,
  activeOrderId,
  onSelectOrder,
  onNewOrder,
}: PendingOrdersProps) {
  const parkedOrders = orders.filter((o) => o._id !== activeOrderId);

  return (
    <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
      {/* Park button — always visible when there's an active order */}
      <div className="flex items-center gap-2">
        <button
          onClick={onNewOrder}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)", border: "1px solid var(--border-color)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
          </svg>
          Park &amp; New Order
        </button>

        {/* Parked orders count */}
        {parkedOrders.length > 0 && (
          <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: "var(--accent-color)", color: "white" }}>
            {parkedOrders.length} parked
          </span>
        )}
      </div>

      {/* Parked orders list */}
      {parkedOrders.length > 0 && (
        <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
          {parkedOrders.map((order: PendingOrder) => (
            <button
              key={order._id}
              onClick={() => onSelectOrder(order._id)}
              className="flex-shrink-0 px-3 py-2 rounded-2xl text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] text-left"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3 shrink-0" style={{ color: "var(--accent-color)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
                <div>
                  <div className="whitespace-nowrap font-semibold">
                    {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} — {formatCurrency(order.subtotal)}
                  </div>
                  <div className="whitespace-nowrap opacity-60">
                    {order.tableName || "Counter"} · {formatTime(order._creationTime)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
