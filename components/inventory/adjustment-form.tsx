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

type AdjustmentFormProps = {
 locations: Location[];
 onClose: () => void;
};

const ADJUSTMENT_TYPES = [
 { value:"wastage", label:"Wastage" },
 { value:"correction", label:"Correction" },
 { value:"stocktake", label:"Stocktake" },
 { value:"transfer", label:"Transfer" },
] as const;

type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number]["value"];

export function AdjustmentForm({ locations, onClose }: AdjustmentFormProps) {
 const { token } = useAuth();
 const logAdjustmentMut = useMutation(
 api.inventory.adjustmentMutations.logAdjustment
 );

 const ingredients = useQuery(
 api.inventory.queries.listIngredients,
 token ? { token } :"skip"
 ) as Ingredient[] | undefined;

 const [ingredientId, setIngredientId] = useState<Id<"ingredients"> |"">(
""
 );
 const [locationId, setLocationId] = useState<Id<"locations"> |"">(
 locations.length === 1 ? locations[0]._id :""
 );
 const [type, setType] = useState<AdjustmentType>("wastage");
 const [quantity, setQuantity] = useState<number>(0);
 const [reason, setReason] = useState("");
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const selectedIngredient = ingredients?.find(
 (i: Ingredient) => i._id === ingredientId
 );

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!token || !ingredientId || !locationId) return;

 if (!reason.trim()) {
 setError("Reason is required");
 return;
 }

 setIsSubmitting(true);
 setError(null);

 try {
 await logAdjustmentMut({
 token,
 ingredientId: ingredientId as Id<"ingredients">,
 locationId: locationId as Id<"locations">,
 type,
 quantity,
 reason: reason.trim(),
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
 <div className="rounded-2xl shadow-2xl w-full max-w-md p-6 border" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>
 Log Stock Adjustment
 </h2>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="flex flex-col gap-4">
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Ingredient *
 </label>
 <select
 required
 value={ingredientId}
 onChange={(e) =>
 setIngredientId(
 e.target.value as Id<"ingredients"> |""
 )
 }
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">Select ingredient</option>
 {ingredients?.map((ing: Ingredient) => (
 <option key={ing._id} value={ing._id}>
 {ing.name} ({ing.unit})
 </option>
 ))}
 </select>
 </div>

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
 Type *
 </label>
 <select
 value={type}
 onChange={(e) => setType(e.target.value as AdjustmentType)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 {ADJUSTMENT_TYPES.map(
 (t: { value: string; label: string }) => (
 <option key={t.value} value={t.value}>
 {t.label}
 </option>
 )
 )}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Quantity *{""}
 <span className="text-stone-400 font-normal">
 (negative to remove)
 </span>
 </label>
 <div className="flex items-center gap-2">
 <input
 type="number"
 required
 step="any"
 value={quantity ||""}
 onChange={(e) => setQuantity(Number(e.target.value))}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="e.g. -5 or 10"
 />
 {selectedIngredient && (
 <span className="text-sm whitespace-nowrap">
 {selectedIngredient.unit}
 </span>
 )}
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Reason *
 </label>
 <textarea
 required
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={2}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors resize-none" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="e.g. Expired milk, physical count correction..."
 />
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
 {isSubmitting ?"Saving..." :"Log Adjustment"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
