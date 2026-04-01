"use client";

import { useState } from"react";
import { useMutation } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

type Modifier = {
 _id: Id<"modifiers">;
 name: string;
 priceAdjustment: number;
 sortOrder: number;
 status:"active" |"inactive";
};

type ModifierOptionListProps = {
 groupId: Id<"modifierGroups">;
 modifiers: Modifier[];
};

function formatPrice(cents: number): string {
 if (cents === 0) return"P0.00";
 const sign = cents > 0 ?"+" :"-";
 return `${sign}P${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function ModifierOptionList({
 groupId,
 modifiers,
}: ModifierOptionListProps) {
 const { token } = useAuth();
 const addModifier = useMutation(api.menu.modifierMutations.addModifier);
 const updateModifier = useMutation(
 api.menu.modifierMutations.updateModifier
 );

 const [showAddForm, setShowAddForm] = useState(false);
 const [editingId, setEditingId] = useState<Id<"modifiers"> | null>(null);
 const [name, setName] = useState("");
 const [priceDisplay, setPriceDisplay] = useState("");
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const resetForm = () => {
 setName("");
 setPriceDisplay("");
 setShowAddForm(false);
 setEditingId(null);
 setError(null);
 };

 const startEdit = (mod: Modifier) => {
 setEditingId(mod._id);
 setName(mod.name);
 setPriceDisplay((mod.priceAdjustment / 100).toFixed(2));
 setShowAddForm(false);
 setError(null);
 };

 const handleAdd = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!token) return;

 setIsSubmitting(true);
 setError(null);

 const priceAdjustment = Math.round(parseFloat(priceDisplay) * 100);
 if (isNaN(priceAdjustment)) {
 setError("Please enter a valid price");
 setIsSubmitting(false);
 return;
 }

 try {
 await addModifier({
 token,
 groupId,
 name,
 priceAdjustment,
 sortOrder: modifiers.length,
 });
 resetForm();
 } catch (err) {
 setError(err instanceof Error ? err.message :"An error occurred");
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleUpdate = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!token || !editingId) return;

 setIsSubmitting(true);
 setError(null);

 const priceAdjustment = Math.round(parseFloat(priceDisplay) * 100);
 if (isNaN(priceAdjustment)) {
 setError("Please enter a valid price");
 setIsSubmitting(false);
 return;
 }

 try {
 await updateModifier({
 token,
 modifierId: editingId,
 name,
 priceAdjustment,
 });
 resetForm();
 } catch (err) {
 setError(err instanceof Error ? err.message :"An error occurred");
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleToggleStatus = async (mod: Modifier) => {
 if (!token) return;
 const newStatus = mod.status ==="active" ?"inactive" :"active";
 await updateModifier({
 token,
 modifierId: mod._id,
 status: newStatus,
 });
 };

 return (
 <div className="mt-3">
 {error && (
 <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs">
 {error}
 </div>
 )}

 {modifiers.length > 0 ? (
 <div className="flex flex-col gap-1">
 {modifiers.map((mod) =>
 editingId === mod._id ? (
 <form
 key={mod._id}
 onSubmit={handleUpdate}
 className="flex items-center gap-2 p-2 bg-blue-500/10 rounded"
 >
 <input
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="flex-1 border rounded px-2 py-1 text-sm"
 placeholder="Option name"
 />
 <input
 type="number"
 step="0.01"
 value={priceDisplay}
 onChange={(e) => setPriceDisplay(e.target.value)}
 className="w-24 border rounded px-2 py-1 text-sm"
 placeholder="0.00"
 />
 <button
 type="submit"
 disabled={isSubmitting}
 className="text-xs font-medium"
 >
 Save
 </button>
 <button
 type="button"
 onClick={resetForm}
 className="text-xs hover:text-gray-700"
 >
 Cancel
 </button>
 </form>
 ) : (
 <div
 key={mod._id}
 className="flex items-center justify-between px-2 py-1.5 rounded group"
 >
 <div className="flex items-center gap-2">
 <span
 className={`text-sm ${mod.status ==="inactive" ?"text-gray-400 line-through" :"text-gray-700"}`}
 >
 {mod.name}
 </span>
 <span className="text-xs">
 {formatPrice(mod.priceAdjustment)}
 </span>
 {mod.status ==="inactive" && (
 <span className="text-xs px-1.5 py-0.5 rounded-full">
 inactive
 </span>
 )}
 </div>
 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={() => startEdit(mod)}
 className="text-xs"
 >
 Edit
 </button>
 <button
 onClick={() => handleToggleStatus(mod)}
 className={`text-xs ${mod.status ==="active" ?"text-orange-600 hover:text-orange-800" :"text-green-600 hover:text-green-800"}`}
 >
 {mod.status ==="active" ?"Deactivate" :"Activate"}
 </button>
 </div>
 </div>
 )
 )}
 </div>
 ) : (
 <p className="text-xs py-1">No options yet.</p>
 )}

 {showAddForm ? (
 <form
 onSubmit={handleAdd}
 className="flex items-center gap-2 mt-2 p-2 rounded"
 >
 <input
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="flex-1 border rounded px-2 py-1 text-sm"
 placeholder="Option name"
 />
 <input
 type="number"
 step="0.01"
 value={priceDisplay}
 onChange={(e) => setPriceDisplay(e.target.value)}
 className="w-24 border rounded px-2 py-1 text-sm"
 placeholder="0.00"
 />
 <button
 type="submit"
 disabled={isSubmitting}
 className="text-xs font-medium"
 >
 {isSubmitting ?"..." :"Add"}
 </button>
 <button
 type="button"
 onClick={resetForm}
 className="text-xs hover:text-gray-700"
 >
 Cancel
 </button>
 </form>
 ) : (
 <button
 onClick={() => {
 resetForm();
 setShowAddForm(true);
 }}
 className="text-xs mt-2"
 >
 + Add Option
 </button>
 )}
 </div>
 );
}
