"use client";

import { useState } from"react";
import { useMutation, useQuery } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

type Location = {
 _id: Id<"locations">;
 name: string;
};

type Ingredient = {
 _id: Id<"ingredients">;
 name: string;
 unit: string;
};

type PurchaseOrderItemDraft = {
 key: string;
 ingredientId: Id<"ingredients"> |"";
 quantityOrdered: number;
 unitCost: number |"";
};

type PurchaseOrderFormProps = {
 locations: Location[];
 onClose: () => void;
};

export function PurchaseOrderForm({
 locations,
 onClose,
}: PurchaseOrderFormProps) {
 const { token } = useAuth();
 const createPurchaseOrder = useMutation(
 api.inventory.purchaseOrderMutations.createPurchaseOrder
 );

 const ingredients = useQuery(
 api.inventory.queries.listIngredients,
 token ? { token } :"skip"
 ) as Ingredient[] | undefined;

 const [locationId, setLocationId] = useState<Id<"locations"> |"">(
 locations.length === 1 ? locations[0]._id :""
 );
 const [supplier, setSupplier] = useState("");
 const [notes, setNotes] = useState("");
 const [items, setItems] = useState<PurchaseOrderItemDraft[]>([
 { key:"1", ingredientId:"", quantityOrdered: 0, unitCost:"" },
 ]);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const addItem = () => {
 setItems((prev: PurchaseOrderItemDraft[]) => [
 ...prev,
 {
 key: String(Date.now()),
 ingredientId:"",
 quantityOrdered: 0,
 unitCost:"",
 },
 ]);
 };

 const removeItem = (key: string) => {
 setItems((prev: PurchaseOrderItemDraft[]) =>
 prev.filter((item: PurchaseOrderItemDraft) => item.key !== key)
 );
 };

 const updateItem = (
 key: string,
 field: keyof PurchaseOrderItemDraft,
 value: string | number
 ) => {
 setItems((prev: PurchaseOrderItemDraft[]) =>
 prev.map((item: PurchaseOrderItemDraft) =>
 item.key === key ? { ...item, [field]: value } : item
 )
 );
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!token || !locationId) return;

 const validItems = items.filter(
 (item: PurchaseOrderItemDraft) =>
 item.ingredientId !=="" && item.quantityOrdered > 0
 );

 if (validItems.length === 0) {
 setError("Add at least one item with a quantity");
 return;
 }

 setIsSubmitting(true);
 setError(null);

 try {
 await createPurchaseOrder({
 token,
 locationId: locationId as Id<"locations">,
 supplier,
 notes: notes || undefined,
 items: validItems.map((item: PurchaseOrderItemDraft) => ({
 ingredientId: item.ingredientId as Id<"ingredients">,
 quantityOrdered: item.quantityOrdered,
 unitCost:
 item.unitCost !=="" ? Number(item.unitCost) : undefined,
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
 <div className="rounded-2xl shadow-2xl w-full max-w-2xl p-6 border max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>
 New Purchase Order
 </h2>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="flex flex-col gap-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Location *
 </label>
 <select
 required
 value={locationId}
 onChange={(e) =>
 setLocationId(e.target.value as Id<"locations"> |"")
 }
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">Select location</option>
 {locations.map((loc: Location) => (
 <option key={loc._id} value={loc._id}>
 {loc.name}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Supplier *
 </label>
 <input
 type="text"
 required
 value={supplier}
 onChange={(e) => setSupplier(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="e.g. Bean Supply Co."
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Notes
 </label>
 <textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={2}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors resize-none" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="Optional notes..."
 />
 </div>

 {/* Items */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="text-sm font-medium" style={{ color: 'var(--muted-fg)' }}>
 Items *
 </label>
 <button
 type="button"
 onClick={addItem}
 className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
 >
 + Add Item
 </button>
 </div>

 <div className="flex flex-col gap-2">
 {items.map((item: PurchaseOrderItemDraft) => (
 <div
 key={item.key}
 className="flex items-center gap-2 rounded-xl p-3"
 >
 <div className="flex-1">
 <select
 value={item.ingredientId}
 onChange={(e) =>
 updateItem(item.key,"ingredientId", e.target.value)
 }
 className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">Select ingredient</option>
 {ingredients?.map((ing: Ingredient) => (
 <option key={ing._id} value={ing._id}>
 {ing.name} ({ing.unit})
 </option>
 ))}
 </select>
 </div>
 <div className="w-28">
 <input
 type="number"
 min={0}
 step="any"
 value={item.quantityOrdered ||""}
 onChange={(e) =>
 updateItem(
 item.key,
"quantityOrdered",
 Number(e.target.value)
 )
 }
 className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="Qty"
 />
 </div>
 <div className="w-28">
 <input
 type="number"
 min={0}
 step="any"
 value={item.unitCost}
 onChange={(e) =>
 updateItem(
 item.key,
"unitCost",
 e.target.value ===""
 ?""
 : Number(e.target.value)
 )
 }
 className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="Cost"
 />
 </div>
 {items.length > 1 && (
 <button
 type="button"
 onClick={() => removeItem(item.key)}
 className="p-1.5 hover:text-red-500 transition-colors"
 title="Remove item"
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
 d="M6 18L18 6M6 6l12 12"
 />
 </svg>
 </button>
 )}
 {items.length <= 1 && (
 <div className="w-7" aria-hidden />
 )}
 </div>
 ))}
 </div>
 <p className="text-xs mt-1">
 {items.length} item{items.length !== 1 ?"s" :""} &middot;
 Select ingredient, enter quantity and optional unit cost
 </p>
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
 className="px-4 py-2.5 text-white rounded-xl disabled:opacity-50 text-sm font-medium transition-colors"
 >
 {isSubmitting ?"Creating..." :"Create Order"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
