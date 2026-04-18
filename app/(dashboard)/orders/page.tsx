"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { RefundDialog } from "@/components/orders/refund-dialog";
import { OrderDetailModal } from "@/components/orders/order-detail-modal";

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
  subtotal: number;
  total: number;
  paymentType: string;
  payments?: Array<{ type: string; amount: number }>;
  itemCount: number;
  status: string;
  baristaName: string;
  locationId: Id<"locations">;
  customerName: string | null;
  customerId: Id<"customers"> | null;
  tableName: string | null;
  discountAmount: number | null;
  discountReason: string | null;
  discountType: string | null;
  discountValue: number | null;
  refundedAt: number | null;
  refundedBy: Id<"users"> | null;
  refundedByName: string | null;
  refundReason: string | null;
  refundAmount: number | null;
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
  paymentType?: string;
  payments?: Array<{ type: string; amount: number }>;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  discountReason?: string;
  refundedAt?: number;
  refundedBy?: Id<"users">;
  refundReason?: string;
  refundAmount?: number;
  customerId?: Id<"customers">;
  tableName?: string;
  completedAt?: number;
  _creationTime: number;
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
  // Use local-time midnight so "today" matches the user's timezone (e.g. Manila),
  // not UTC. Otherwise early-morning orders fall outside the visible window.
  const parts = dateStr.split("-");
  return new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10),
    0,
    0,
    0,
    0
  ).getTime();
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

function formatFullDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
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
  const [searchQuery, setSearchQuery] = useState("");
  const [viewOrderId, setViewOrderId] = useState<Id<"orders"> | null>(null);
  const [refundTarget, setRefundTarget] = useState<{
    orderId: Id<"orders">;
    orderTotal: number;
    orderNumber: string;
  } | null>(null);

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

  const statusArg =
    statusFilter === "completed" ||
    statusFilter === "voided" ||
    statusFilter === "refunded"
      ? (statusFilter as "completed" | "voided" | "refunded")
      : undefined;

  const paymentArg =
    paymentFilter === "cash" ||
    paymentFilter === "card" ||
    paymentFilter === "ewallet"
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
          searchQuery: searchQuery.trim() || undefined,
        }
      : "skip"
  ) as OrderHistoryItem[] | undefined;

  const {
    paginatedItems: paginatedOrders,
    currentPage: ordersPage,
    totalPages: ordersTotalPages,
    setCurrentPage: setOrdersPage,
  } = usePagination(orders ?? []);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }

  const canRefund = session.role === "owner" || session.role === "manager";

  const handleRowClick = (orderId: Id<"orders">) => {
    setViewOrderId(orderId);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
          Order History
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
          Review completed, voided, and refunded orders
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border shadow-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label
              className="block text-xs font-medium uppercase tracking-wide mb-1.5"
              style={{ color: "var(--muted-fg)" }}
            >
              Search Order #
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              placeholder="e.g. ORD-..."
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>
          <div>
            <label
              className="block text-xs font-medium uppercase tracking-wide mb-1.5"
              style={{ color: "var(--muted-fg)" }}
            >
              Start Date
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setStartDateStr(e.target.value)
              }
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>
          <div>
            <label
              className="block text-xs font-medium uppercase tracking-wide mb-1.5"
              style={{ color: "var(--muted-fg)" }}
            >
              End Date
            </label>
            <input
              type="date"
              value={endDateStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEndDateStr(e.target.value)
              }
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>
          {availableLocations.length > 1 && (
            <div>
              <label
                className="block text-xs font-medium uppercase tracking-wide mb-1.5"
                style={{ color: "var(--muted-fg)" }}
              >
                Location
              </label>
              <select
                value={selectedLocationId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedLocationId(e.target.value)
                }
                className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--fg)",
                  border: "1px solid var(--border-color)",
                }}
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
            <label
              className="block text-xs font-medium uppercase tracking-wide mb-1.5"
              style={{ color: "var(--muted-fg)" }}
            >
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setStatusFilter(e.target.value)
              }
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label
              className="block text-xs font-medium uppercase tracking-wide mb-1.5"
              style={{ color: "var(--muted-fg)" }}
            >
              Payment
            </label>
            <select
              value={paymentFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setPaymentFilter(e.target.value)
              }
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
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
        <div className="text-center py-12">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          No orders found for the selected filters.
        </div>
      ) : (
        <div
          className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <table className="w-full">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Order #
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Date / Time
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Customer
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Table
                </th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Items
                </th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Subtotal
                </th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Discount
                </th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Total
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Payment
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Status
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Barista
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order: OrderHistoryItem) => (
                <OrderRow
                  key={order._id}
                  order={order}
                  onView={() => handleRowClick(order._id)}
                  canRefund={canRefund}
                  onRefund={() =>
                    setRefundTarget({
                      orderId: order._id,
                      orderTotal: order.total,
                      orderNumber: order.orderNumber,
                    })
                  }
                />
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={ordersPage}
            totalPages={ordersTotalPages}
            onPageChange={setOrdersPage}
          />
        </div>
      )}

      {/* Order Detail Modal */}
      {viewOrderId && (
        <OrderDetailModal
          orderId={viewOrderId}
          onClose={() => setViewOrderId(null)}
          canRefund={canRefund}
          onRefund={() => {
            const order = (orders ?? []).find((o: OrderHistoryItem) => o._id === viewOrderId);
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

      {/* Refund Dialog */}
      {refundTarget && (
        <RefundDialog
          orderId={refundTarget.orderId}
          orderTotal={refundTarget.orderTotal}
          orderNumber={refundTarget.orderNumber}
          onClose={() => setRefundTarget(null)}
          onRefunded={() => setRefundTarget(null)}
        />
      )}
    </div>
  );
}

function getStatusDisplay(order: OrderHistoryItem): {
  label: string;
  className: string;
} {
  if (order.refundedAt) {
    return {
      label: "Refunded",
      className: "bg-amber-500/10 text-amber-400",
    };
  }
  if (order.status === "completed") {
    return {
      label: "Completed",
      className: "bg-emerald-500/10 text-emerald-400",
    };
  }
  return {
    label: "Voided",
    className: "bg-red-500/10 text-red-400",
  };
}

function OrderRow({
  order,
  onView,
  canRefund,
  onRefund,
}: {
  order: OrderHistoryItem;
  onView: () => void;
  canRefund: boolean;
  onRefund: () => void;
}) {
  const statusDisplay = getStatusDisplay(order);
  const showRefundBtn =
    canRefund && order.status === "completed" && !order.refundedAt;

  return (
      <tr
        className="hover:opacity-80 transition-colors cursor-pointer"
        onClick={onView}
        style={{ borderBottom: "1px solid var(--border-color)" }}
      >
        <td
          className="px-5 py-3.5 font-medium"
          style={{ color: "var(--fg)" }}
        >
          {order.orderNumber || "--"}
        </td>
        <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
          {formatDateTime(order.completedAt)}
        </td>
        <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
          {order.customerName ?? "Walk-in"}
        </td>
        <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
          {order.tableName ?? "Takeout"}
        </td>
        <td
          className="px-5 py-3.5 text-right"
          style={{ color: "var(--muted-fg)" }}
        >
          {order.itemCount}
        </td>
        <td
          className="px-5 py-3.5 text-right"
          style={{ color: "var(--muted-fg)" }}
        >
          {formatCurrency(order.subtotal)}
        </td>
        <td
          className="px-5 py-3.5 text-right"
          style={{ color: "var(--muted-fg)" }}
        >
          {order.discountAmount ? (
            <span className="text-amber-400">
              -{formatCurrency(order.discountAmount)}
            </span>
          ) : (
            "--"
          )}
        </td>
        <td
          className="px-5 py-3.5 text-right font-medium"
          style={{ color: "var(--fg)" }}
        >
          {formatCurrency(order.total)}
          {order.refundAmount ? (
            <div className="text-xs text-red-400">
              -{formatCurrency(order.refundAmount)}
            </div>
          ) : null}
        </td>
        <td
          className="px-5 py-3.5 capitalize"
          style={{ color: "var(--muted-fg)" }}
        >
          {order.paymentType === "ewallet" ? "E-Wallet" : order.paymentType}
        </td>
        <td className="px-5 py-3.5">
          <span
            className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${statusDisplay.className}`}
          >
            {statusDisplay.label}
          </span>
        </td>
        <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
          {order.baristaName}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className="px-3 py-1 text-xs font-medium rounded-lg transition-colors"
              style={{
                border: "1px solid var(--border-color)",
                color: "var(--muted-fg)",
              }}
            >
              View
            </button>
            {showRefundBtn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRefund();
                }}
                className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
              >
                Refund
              </button>
            )}
          </div>
        </td>
      </tr>
  );
}

