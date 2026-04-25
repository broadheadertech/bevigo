"use client";

import { useEffect, useRef, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type PendingOrder = {
  _id: Id<"orders">;
  userId: Id<"users">;
  baristaName?: string;
  isMine?: boolean;
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
  onDeleteOrder?: (orderId: Id<"orders">) => void;
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
  onDeleteOrder,
}: PendingOrdersProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<Id<"orders"> | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const parkedOrders = orders.filter((o) => o._id !== activeOrderId);
  const confirmOrder = confirmDeleteId ? parkedOrders.find((o) => o._id === confirmDeleteId) : null;
  const confirmIndex = confirmOrder ? parkedOrders.indexOf(confirmOrder) : -1;

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close dropdown when there's nothing left to show
  useEffect(() => {
    if (parkedOrders.length === 0) setOpen(false);
  }, [parkedOrders.length]);

  return (
    <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
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

        {/* Parked dropdown trigger */}
        {parkedOrders.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: open ? "var(--accent-color)" : "var(--muted)",
                color: open ? "white" : "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
              aria-expanded={open}
              aria-haspopup="listbox"
            >
              <span
                className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: open ? "rgba(255,255,255,0.25)" : "var(--accent-color)",
                  color: "white",
                }}
              >
                {parkedOrders.length}
              </span>
              Parked
              <svg
                className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div
                className="absolute top-full left-0 mt-1 z-30 rounded-2xl shadow-2xl overflow-hidden"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border-color)",
                  minWidth: "280px",
                  maxHeight: "60vh",
                }}
                role="listbox"
              >
                <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
                  {parkedOrders.map((order: PendingOrder, index: number) => (
                    <div
                      key={order._id}
                      className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-stone-500/10"
                      style={{ borderBottom: index < parkedOrders.length - 1 ? "1px solid var(--border-color)" : "none" }}
                    >
                      <button
                        onClick={() => {
                          onSelectOrder(order._id);
                          setOpen(false);
                        }}
                        className="flex-1 flex items-center gap-2 text-left"
                        role="option"
                        aria-selected={false}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                          style={{ backgroundColor: "var(--accent-color)", color: "white" }}
                        >
                          P{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: "var(--fg)" }}>
                            {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} — {formatCurrency(order.subtotal)}
                          </div>
                          <div className="text-[10px] truncate" style={{ color: "var(--muted-fg)" }}>
                            {order.tableName || "Counter"} · {formatTime(order._creationTime)}
                          </div>
                        </div>
                      </button>
                      {onDeleteOrder && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(order._id);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-xs shrink-0 transition-colors hover:bg-red-500/20 text-red-400"
                          title="Cancel parked order"
                        >
                          &#10005;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Cancel Parked Order"
        message={
          confirmOrder
            ? `Cancel parked order P${confirmIndex + 1} with ${confirmOrder.itemCount} item${confirmOrder.itemCount !== 1 ? "s" : ""} (${formatCurrency(confirmOrder.subtotal)})?`
            : ""
        }
        confirmLabel="Cancel Order"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteId && onDeleteOrder) {
            onDeleteOrder(confirmDeleteId);
          }
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
