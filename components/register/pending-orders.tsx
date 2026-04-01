"use client";

import { Id } from "../../convex/_generated/dataModel";

type PendingOrder = {
  _id: Id<"orders">;
  userId: Id<"users">;
  subtotal: number;
  itemCount: number;
  _creationTime: number;
};

type PendingOrdersProps = {
  orders: PendingOrder[];
  activeOrderId: Id<"orders"> | null;
  onSelectOrder: (orderId: Id<"orders">) => void;
  onNewOrder: () => void;
};

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

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
  if (orders.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-stone-100 border-b border-stone-200 overflow-x-auto">
      {orders.map((order) => {
        const isActive = order._id === activeOrderId;
        return (
          <button
            key={order._id}
            onClick={() => onSelectOrder(order._id)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[48px] min-w-[48px] ${
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700 active:bg-stone-100"
            }`}
          >
            <div className="whitespace-nowrap">
              {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
            </div>
            <div className="whitespace-nowrap">
              {formatPrice(order.subtotal)}
            </div>
            <div className="whitespace-nowrap text-[10px] opacity-70">
              {formatTime(order._creationTime)}
            </div>
          </button>
        );
      })}
      <button
        onClick={onNewOrder}
        className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-dashed border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700 active:bg-stone-100 transition-colors min-h-[48px] min-w-[48px]"
      >
        + New
      </button>
    </div>
  );
}
