"use client";

import { useState } from"react";
import { useMutation, useQuery } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

type IngredientFormProps = {
 editingIngredient?: {
 _id: Id<"ingredients">;
 name: string;
 unit: string;
 category?: string;
 reorderThreshold: number;
 status:"active" |"inactive";
 defaultSupplierId?: Id<"suppliers"> | null;
 } | null;
 onClose: () => void;
};

type SupplierOption = { _id: Id<"suppliers">; name: string; status: "active" | "inactive" };

const UNIT_OPTIONS = ["g","ml","pcs","kg","L"];

export function IngredientForm({
 editingIngredient,
 onClose,
}: IngredientFormProps) {
 const { token } = useAuth();
 const createIngredient = useMutation(api.inventory.mutations.createIngredient);
 const updateIngredient = useMutation(api.inventory.mutations.updateIngredient);

 const [name, setName] = useState(editingIngredient?.name ??"");
 const [unit, setUnit] = useState(editingIngredient?.unit ??"g");
 const [category, setCategory] = useState(editingIngredient?.category ??"");
 const [reorderThreshold, setReorderThreshold] = useState(
 editingIngredient?.reorderThreshold ?? 10
 );
 const [supplierId, setSupplierId] = useState<string>(
 editingIngredient?.defaultSupplierId ?? ""
 );
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const suppliers = useQuery(
 api.suppliers.queries.list,
 token ? { token } : "skip"
 ) as SupplierOption[] | undefined;
 const activeSuppliers = (suppliers ?? []).filter((s) => s.status === "active");

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!token) return;

 setIsSubmitting(true);
 setError(null);

 try {
 if (editingIngredient) {
 await updateIngredient({
 token,
 ingredientId: editingIngredient._id,
 name,
 unit,
 category: category || undefined,
 reorderThreshold,
 ...(supplierId
 ? { defaultSupplierId: supplierId as Id<"suppliers"> }
 : { clearSupplier: true }),
 });
 } else {
 await createIngredient({
 token,
 name,
 unit,
 category: category || undefined,
 reorderThreshold,
 defaultSupplierId: supplierId
 ? (supplierId as Id<"suppliers">)
 : undefined,
 });
 }
 onClose();
 } catch (err) {
 setError(err instanceof Error ? err.message :"An error occurred");
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="rounded-2xl shadow-2xl w-full max-w-md p-6 border" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>
 {editingIngredient ?"Edit Ingredient" :"Add Ingredient"}
 </h2>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="flex flex-col gap-4">
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Name *
 </label>
 <input
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="e.g. Espresso Beans"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Unit *
 </label>
 <select
 value={unit}
 onChange={(e) => setUnit(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 {UNIT_OPTIONS.map((u: string) => (
 <option key={u} value={u}>
 {u}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Category
 </label>
 <input
 type="text"
 value={category}
 onChange={(e) => setCategory(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="e.g. Coffee, Dairy, Supplies"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Reorder Threshold *
 </label>
 <input
 type="number"
 required
 min={0}
 value={reorderThreshold}
 onChange={(e) => setReorderThreshold(Number(e.target.value))}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 <p className="text-xs mt-1">
 Alert when stock falls below this level
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Supplier (optional)
 </label>
 <select
 value={supplierId}
 onChange={(e) => setSupplierId(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
 style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">— None —</option>
 {activeSuppliers.map((s) => (
 <option key={s._id} value={s._id}>{s.name}</option>
 ))}
 </select>
 <p className="text-xs mt-1">
 Manage suppliers in <span className="italic">Suppliers</span>. Leave blank for in-house ingredients.
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
 {isSubmitting
 ?"Saving..."
 : editingIngredient
 ?"Update"
 :"Create"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
