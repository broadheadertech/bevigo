"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type PurchaseOrderItem = {
  _id: Id<"purchaseOrderItems">;
  ingredientId: Id<"ingredients">;
  ingredientName: string;
  ingredientUnit: string;
  quantityOrdered: number;
  quantityReceived?: number;
};

type ReceiveDialogProps = {
  purchaseOrderId: Id<"purchaseOrders">;
  supplier: string;
  items: PurchaseOrderItem[];
  onClose: () => void;
};

type ReceivedEntry = {
  itemId: Id<"purchaseOrderItems">;
  quantityReceived: number;
};

export function ReceiveDialog({
  purchaseOrderId,
  supplier,
  items,
  onClose,
}: ReceiveDialogProps) {
  const { token } = useAuth();
  const receivePurchaseOrder = useMutation(
    api.inventory.purchaseOrderMutations.receivePurchaseOrder
  );

  const [receivedQuantities, setReceivedQuantities] = useState<
    Map<string, number>
  >(
    () =>
      new Map(
        items.map((item: PurchaseOrderItem) => [
          item._id as string,
          item.quantityOrdered,
        ])
      )
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateQuantity = (itemId: string, value: number) => {
    setReceivedQuantities((prev: Map<string, number>) => {
      const next = new Map(prev);
      next.set(itemId, value);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const receivedItems: ReceivedEntry[] = items.map(
        (item: PurchaseOrderItem) => ({
          itemId: item._id,
          quantityReceived:
            receivedQuantities.get(item._id as string) ??
            item.quantityOrdered,
        })
      );

      await receivePurchaseOrder({
        token,
        purchaseOrderId,
        receivedItems: receivedItems.map((ri: ReceivedEntry) => ({
          purchaseOrderItemId: ri.itemId,
          quantityReceived: ri.quantityReceived,
        })),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-lg p-6 border border-stone-200/60 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-stone-900 mb-1">
          Receive Purchase Order
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
          From <span className="font-medium text-stone-700">{supplier}</span>
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="bg-stone-50 dark:bg-stone-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-700">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Ingredient
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Ordered
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {items.map((item: PurchaseOrderItem) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3 text-stone-800 dark:text-stone-200">
                      {item.ingredientName}
                      <span className="text-stone-400 ml-1 text-xs">
                        {item.ingredientUnit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600 dark:text-stone-400">
                      {item.quantityOrdered}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={
                          receivedQuantities.get(item._id as string) ?? ""
                        }
                        onChange={(e) =>
                          updateQuantity(
                            item._id as string,
                            Number(e.target.value)
                          )
                        }
                        className="w-24 text-right border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors bg-white"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {isSubmitting ? "Processing..." : "Confirm Received"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
