"use client";

import { useState } from"react";
import { useMutation } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

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
 setError(err instanceof Error ? err.message :"An error occurred");
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="rounded-2xl shadow-2xl w-full max-w-lg p-6 border max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>
 Receive Purchase Order
 </h2>
 <p className="text-sm mb-4">
 From <span className="font-medium">{supplier}</span>
 </p>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="flex flex-col gap-3">
 <div className="rounded-3xl shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <table className="w-full text-sm">
 <thead>
 <tr style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Ingredient
 </th>
 <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Ordered
 </th>
 <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Received
 </th>
 </tr>
 </thead>
 <tbody>
 {items.map((item: PurchaseOrderItem) => (
 <tr key={item._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
 <td className="px-5 py-3.5" style={{ color: 'var(--fg)' }}>
 {item.ingredientName}
 <span className="ml-1 text-xs" style={{ color: 'var(--muted-fg)' }}>
 {item.ingredientUnit}
 </span>
 </td>
 <td className="px-5 py-3.5 text-right" style={{ color: 'var(--muted-fg)' }}>
 {item.quantityOrdered}
 </td>
 <td className="px-5 py-3.5 text-right">
 <input
 type="number"
 min={0}
 step="any"
 value={
 receivedQuantities.get(item._id as string) ??""
 }
 onChange={(e) =>
 updateQuantity(
 item._id as string,
 Number(e.target.value)
 )
 }
 className="w-24 text-right rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
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
 className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isSubmitting}
 className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors"
 >
 {isSubmitting ?"Processing..." :"Confirm Received"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
