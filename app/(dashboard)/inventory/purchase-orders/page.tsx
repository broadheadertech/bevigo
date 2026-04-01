"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { PurchaseOrderForm } from "@/components/inventory/purchase-order-form";
import { ReceiveDialog } from "@/components/inventory/receive-dialog";

type Location = {
  _id: Id<"locations">;
  name: string;
  slug: string;
  status: string;
};

type PurchaseOrder = {
  _id: Id<"purchaseOrders">;
  tenantId: Id<"tenants">;
  locationId: Id<"locations">;
  userId: Id<"users">;
  supplier: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  notes?: string;
  orderedAt?: number;
  receivedAt?: number;
  updatedAt: number;
  locationName: string;
  userName: string;
  itemCount: number;
  _creationTime: number;
};

type PurchaseOrderDetail = {
  _id: Id<"purchaseOrders">;
  tenantId: Id<"tenants">;
  locationId: Id<"locations">;
  userId: Id<"users">;
  supplier: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  notes?: string;
  orderedAt?: number;
  receivedAt?: number;
  updatedAt: number;
  locationName: string;
  userName: string;
  items: PurchaseOrderItem[];
};

type PurchaseOrderItem = {
  _id: Id<"purchaseOrderItems">;
  ingredientId: Id<"ingredients">;
  ingredientName: string;
  ingredientUnit: string;
  quantityOrdered: number;
  quantityReceived?: number;
  unitCost?: number;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  ordered: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? "bg-stone-100 text-stone-600"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDate(ts: number | undefined) {
  if (!ts) return "-";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PurchaseOrdersPage() {
  const { session, token } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] =
    useState<Id<"purchaseOrders"> | null>(null);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as Location[] | undefined;

  const orders = useQuery(
    api.inventory.purchaseOrderQueries.listPurchaseOrders,
    token
      ? {
          token,
          ...(statusFilter
            ? {
                status: statusFilter as
                  | "draft"
                  | "ordered"
                  | "received"
                  | "cancelled",
              }
            : {}),
        }
      : "skip"
  ) as PurchaseOrder[] | undefined;

  const orderDetail = useQuery(
    api.inventory.purchaseOrderQueries.getPurchaseOrder,
    token && selectedOrderId
      ? { token, purchaseOrderId: selectedOrderId }
      : "skip"
  ) as PurchaseOrderDetail | undefined;

  const updateStatus = useMutation(
    api.inventory.purchaseOrderMutations.updatePurchaseOrderStatus
  );

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const handleStatusChange = async (
    purchaseOrderId: Id<"purchaseOrders">,
    newStatus: "draft" | "ordered" | "received" | "cancelled"
  ) => {
    if (!token) return;
    await updateStatus({ token, purchaseOrderId, status: newStatus });
  };

  const activeLocations = (locations ?? []).filter(
    (l: Location) => l.status === "active"
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            Purchase Orders
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Manage supplier orders and receiving
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 transition-colors shadow-sm"
        >
          + New Purchase Order
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {["", "draft", "ordered", "received", "cancelled"].map(
          (s: string) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-stone-900 text-white"
                  : "bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700"
              }`}
            >
              {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Orders list or detail */}
      {selectedOrderId && orderDetail ? (
        <div>
          <button
            onClick={() => setSelectedOrderId(null)}
            className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 mb-4 flex items-center gap-1 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to list
          </button>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {orderDetail.supplier}
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                  {orderDetail.locationName} &middot; Created by{" "}
                  {orderDetail.userName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={orderDetail.status} />
                {orderDetail.status === "draft" && (
                  <button
                    onClick={() =>
                      handleStatusChange(orderDetail._id, "ordered")
                    }
                    className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-200 transition-colors"
                  >
                    Mark Ordered
                  </button>
                )}
                {orderDetail.status === "ordered" && (
                  <button
                    onClick={() => setShowReceiveDialog(true)}
                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-200 transition-colors"
                  >
                    Receive
                  </button>
                )}
                {(orderDetail.status === "draft" ||
                  orderDetail.status === "ordered") && (
                  <button
                    onClick={() =>
                      handleStatusChange(orderDetail._id, "cancelled")
                    }
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {orderDetail.notes && (
              <p className="text-sm text-stone-600 mb-4 bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                {orderDetail.notes}
              </p>
            )}

            <div className="text-xs text-stone-400 flex gap-4 mb-4">
              {orderDetail.orderedAt && (
                <span>Ordered: {formatDate(orderDetail.orderedAt)}</span>
              )}
              {orderDetail.receivedAt && (
                <span>Received: {formatDate(orderDetail.receivedAt)}</span>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-700">
                  <th className="text-left py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Ingredient
                  </th>
                  <th className="text-right py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Ordered
                  </th>
                  <th className="text-right py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Received
                  </th>
                  <th className="text-right py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Unit Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {orderDetail.items.map((item: PurchaseOrderItem) => (
                  <tr key={item._id}>
                    <td className="py-3 text-stone-800 dark:text-stone-200">
                      {item.ingredientName}{" "}
                      <span className="text-stone-400 text-xs">
                        {item.ingredientUnit}
                      </span>
                    </td>
                    <td className="py-3 text-right text-stone-600 dark:text-stone-400">
                      {item.quantityOrdered}
                    </td>
                    <td className="py-3 text-right text-stone-600 dark:text-stone-400">
                      {item.quantityReceived != null
                        ? item.quantityReceived
                        : "-"}
                    </td>
                    <td className="py-3 text-right text-stone-600 dark:text-stone-400">
                      {item.unitCost != null
                        ? `${(item.unitCost / 100).toFixed(2)}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showReceiveDialog && orderDetail.status === "ordered" && (
            <ReceiveDialog
              purchaseOrderId={orderDetail._id}
              supplier={orderDetail.supplier}
              items={orderDetail.items}
              onClose={() => setShowReceiveDialog(false)}
            />
          )}
        </div>
      ) : (
        <div>
          {orders === undefined ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-stone-400">Loading purchase orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-stone-400">
                No purchase orders yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((order: PurchaseOrder) => (
                <button
                  key={order._id}
                  onClick={() => setSelectedOrderId(order._id)}
                  className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-4 text-left hover:border-stone-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {order.supplier}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                        {order.locationName} &middot; {order.itemCount} item
                        {order.itemCount !== 1 ? "s" : ""} &middot;{" "}
                        {formatDate(order._creationTime)}
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-stone-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New PO form */}
      {showForm && (
        <PurchaseOrderForm
          locations={activeLocations}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
