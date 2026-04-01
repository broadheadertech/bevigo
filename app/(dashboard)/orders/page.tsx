"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type LocationOption = {
  _id: Id<"locations">;
  name: string;
  slug: string;
  status: string;
};

type OrderHistoryItem = {
  _id: Id<"orders">;
  orderNumber: string;
  completedAt: number;
  total: number;
  paymentType: string;
  itemCount: number;
  status: string;
  baristaName: string;
  locationId: Id<"locations">;
};

type OrderItemModifier = {
  _id: Id<"orderItemModifiers">;
  modifierName: string;
  priceAdjustment: number;
};

type OrderItemDetail = {
  _id: Id<"orderItems">;
  itemName: string;
  basePrice: number;
  quantity: number;
  subtotal: number;
  modifiers: OrderItemModifier[];
};

type OrderWithItems = {
  _id: Id<"orders">;
  subtotal: number;
  taxAmount: number;
  taxLabel: string;
  total: number;
  items: OrderItemDetail[];
};

function todayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateToTimestamp(dateStr: string): number {
  const parts = dateStr.split("-");
  return Date.UTC(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function OrderHistoryPage() {
  const { session, token } = useAuth();

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("");
  const [startDateStr, setStartDateStr] = useState(todayStr());
  const [endDateStr, setEndDateStr] = useState(todayStr());
  const [expandedOrderId, setExpandedOrderId] = useState<Id<"orders"> | null>(
    null
  );

  const locationId = selectedLocationId
    ? (selectedLocationId as Id<"locations">)
    : undefined;

  const startDate = useMemo(
    () => dateToTimestamp(startDateStr),
    [startDateStr]
  );
  const endDate = useMemo(
    () => dateToTimestamp(endDateStr) + 24 * 60 * 60 * 1000 - 1,
    [endDateStr]
  );

  const statusArg = statusFilter === "completed" || statusFilter === "voided"
    ? (statusFilter as "completed" | "voided")
    : undefined;

  const paymentArg =
    paymentFilter === "cash" || paymentFilter === "card" || paymentFilter === "ewallet"
      ? (paymentFilter as "cash" | "card" | "ewallet")
      : undefined;

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as LocationOption[] | undefined;

  const availableLocations = useMemo(() => {
    if (!locations || !session) return [];
    if (session.role === "owner") return locations;
    return locations.filter((loc: LocationOption) =>
      session.locationIds.includes(loc._id)
    );
  }, [locations, session]);

  const orders = useQuery(
    api.orders.historyQueries.listOrderHistory,
    token && session && (session.role === "owner" || session.role === "manager")
      ? {
          token,
          locationId,
          status: statusArg,
          startDate,
          endDate,
          paymentType: paymentArg,
        }
      : "skip"
  ) as OrderHistoryItem[] | undefined;

  const orderDetails = useQuery(
    api.orders.queries.getOrderWithItems,
    token && expandedOrderId
      ? { token, orderId: expandedOrderId }
      : "skip"
  ) as OrderWithItems | null | undefined;

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const handleRowClick = (orderId: Id<"orders">) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Order History</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
          Review completed and voided orders
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setStartDateStr(e.target.value)
              }
              className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={endDateStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEndDateStr(e.target.value)
              }
              className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
          </div>
          {availableLocations.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
                Location
              </label>
              <select
                value={selectedLocationId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedLocationId(e.target.value)
                }
                className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              >
                <option value="">All Locations</option>
                {availableLocations.map((loc: LocationOption) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setStatusFilter(e.target.value)
              }
              className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              Payment
            </label>
            <select
              value={paymentFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setPaymentFilter(e.target.value)
              }
              className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            >
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="ewallet">E-Wallet</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {!orders ? (
        <div className="text-center text-stone-400 py-12">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center text-stone-400 py-12">
          No orders found for the selected filters.
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50/50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Order #
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Date / Time
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Items
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Total
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Payment
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Barista
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {orders.map((order: OrderHistoryItem) => (
                <OrderRow
                  key={order._id}
                  order={order}
                  isExpanded={expandedOrderId === order._id}
                  onToggle={() => handleRowClick(order._id)}
                  details={
                    expandedOrderId === order._id ? orderDetails : undefined
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  isExpanded,
  onToggle,
  details,
}: {
  order: OrderHistoryItem;
  isExpanded: boolean;
  onToggle: () => void;
  details: OrderWithItems | null | undefined;
}) {
  return (
    <>
      <tr
        className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-5 py-3.5 font-medium text-stone-900 dark:text-stone-100">
          {order.orderNumber || "--"}
        </td>
        <td className="px-5 py-3.5 text-stone-600">
          {formatDateTime(order.completedAt)}
        </td>
        <td className="px-5 py-3.5 text-right text-stone-600 dark:text-stone-400">
          {order.itemCount}
        </td>
        <td className="px-5 py-3.5 text-right font-medium text-stone-900 dark:text-stone-100">
          {formatCurrency(order.total)}
        </td>
        <td className="px-5 py-3.5 text-stone-600 dark:text-stone-400 capitalize">
          {order.paymentType === "ewallet" ? "E-Wallet" : order.paymentType}
        </td>
        <td className="px-5 py-3.5">
          <span
            className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
              order.status === "completed"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {order.status}
          </span>
        </td>
        <td className="px-5 py-3.5 text-stone-600">{order.baristaName}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-5 py-4 bg-stone-50/50">
            {details === undefined ? (
              <p className="text-sm text-stone-400">Loading details...</p>
            ) : details === null ? (
              <p className="text-sm text-stone-400">Order details not found.</p>
            ) : (
              <div className="space-y-2">
                {details.items.map((item: OrderItemDetail) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-medium text-stone-900 dark:text-stone-100">
                        {item.quantity > 1 && (
                          <span className="text-stone-500 mr-1">
                            {item.quantity}x
                          </span>
                        )}
                        {item.itemName}
                      </span>
                      {item.modifiers.length > 0 && (
                        <span className="text-stone-500 ml-2">
                          (
                          {item.modifiers
                            .map((m: OrderItemModifier) => m.modifierName)
                            .join(", ")}
                          )
                        </span>
                      )}
                    </div>
                    <span className="text-stone-700 font-medium">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-stone-200 dark:border-stone-700 pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-sm text-stone-600 dark:text-stone-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(details.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-stone-600 dark:text-stone-400">
                    <span>{details.taxLabel}</span>
                    <span>{formatCurrency(details.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-stone-900 dark:text-stone-100">
                    <span>Total</span>
                    <span>{formatCurrency(details.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
