"use client";

import { useState } from"react";
import { useMutation, useQuery } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";
import { useConfirm } from"@/lib/confirm-context";

type Modifier = {
 _id: Id<"modifiers">;
 name: string;
 priceAdjustment: number;
 sortOrder: number;
 status:"active" |"inactive";
 isDefault?: boolean;
};

type ModifierOptionListProps = {
 groupId: Id<"modifierGroups">;
 modifiers: Modifier[];
 maxSelect?: number; // single-select groups use exclusive default
};

function formatPrice(cents: number): string {
 if (cents === 0) return"P0.00";
 const sign = cents > 0 ?"+" :"-";
 return `${sign}P${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function ModifierOptionList({
 groupId,
 modifiers,
 maxSelect = 1,
}: ModifierOptionListProps) {
 const { token } = useAuth();
 const addModifier = useMutation(api.menu.modifierMutations.addModifier);
 const updateModifier = useMutation(
 api.menu.modifierMutations.updateModifier
 );
 const setAsDefault = useMutation(api.menu.modifierMutations.setAsDefault);
 const clearDefault = useMutation(api.menu.modifierMutations.clearDefault);
 const deleteModifier = useMutation(api.menu.modifierMutations.deleteModifier);
 const confirm = useConfirm();

 const [showAddForm, setShowAddForm] = useState(false);
 const [editingId, setEditingId] = useState<Id<"modifiers"> | null>(null);
 const [recipeForId, setRecipeForId] = useState<Id<"modifiers"> | null>(null);
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

 const handleToggleDefault = async (mod: Modifier) => {
 if (!token) return;
 if (mod.isDefault) {
 await clearDefault({ token, modifierId: mod._id });
 } else {
 await setAsDefault({ token, modifierId: mod._id, exclusive: maxSelect === 1 });
 }
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
 <div key={mod._id}>
 <div className="flex items-center justify-between px-2 py-1.5 rounded group">
 <div className="flex items-center gap-2">
 <span
 className={`text-sm ${mod.status ==="inactive" ?"text-gray-400 line-through" :"text-gray-700"}`}
 >
 {mod.name}
 </span>
 <span className="text-xs">
 {formatPrice(mod.priceAdjustment)}
 </span>
 {mod.isDefault && (
 <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
 Default
 </span>
 )}
 {mod.status ==="inactive" && (
 <span className="text-xs px-1.5 py-0.5 rounded-full">
 inactive
 </span>
 )}
 </div>
 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={() => handleToggleDefault(mod)}
 className="text-xs"
 style={{ color: mod.isDefault ? 'var(--muted-fg)' : 'var(--accent-color)' }}
 >
 {mod.isDefault ?"Unset default" :"Set as default"}
 </button>
 <button
 onClick={() =>
 setRecipeForId(recipeForId === mod._id ? null : mod._id)
 }
 className="text-xs text-sky-400 hover:text-sky-300"
 title="Edit ingredient deductions for this option"
 >
 {recipeForId === mod._id ?"Hide recipe" :"Recipe"}
 </button>
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
 <button
 onClick={async () => {
 if (!token) return;
 const ok = await confirm({
 title: `Delete option "${mod.name}"?`,
 message:
 "This permanently removes the modifier option and any ingredient deduction rows attached to it. Past order line items keep the modifier name as text and aren't affected.",
 confirmLabel: "Delete",
 danger: true,
 });
 if (!ok) return;
 try {
 if (recipeForId === mod._id) setRecipeForId(null);
 await deleteModifier({ token, modifierId: mod._id });
 } catch (e) {
 await confirm({
 title:"Couldn't delete",
 message: e instanceof Error ? e.message :"Delete failed",
 confirmLabel:"OK",
 cancelLabel:"Close",
 });
 }
 }}
 className="text-xs text-red-400 hover:text-red-300 font-medium"
 title="Permanently delete this option (cascades its ingredient rows)"
 >
 Delete
 </button>
 </div>
 </div>
 {recipeForId === mod._id && (
 <ModifierRecipeEditor modifierId={mod._id} />
 )}
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

// ─────────────────────────────────────────────────────────────────────────
// Per-modifier recipe editor (shown inline under a modifier option).
// Lets the operator declare "when this modifier is chosen, deduct X of
// ingredient Y" — and optionally swap a base ingredient (e.g. Oat Milk
// replaces Regular Milk).
// ─────────────────────────────────────────────────────────────────────────

type IngOpt = {
 _id: Id<"ingredients">;
 name: string;
 unit: string;
 status:"active" |"inactive";
};

type ModifierRecipeRow = {
 _id: Id<"modifierRecipes">;
 ingredientId: Id<"ingredients">;
 ingredientName: string;
 ingredientUnit: string;
 quantityUsed: number;
 replacesIngredientId?: Id<"ingredients">;
 replacesIngredientName?: string;
 variantKey: string | null;
 priceAdjustment: number | null;
};

function ModifierRecipeEditor({ modifierId }: { modifierId: Id<"modifiers"> }) {
 const { token } = useAuth();
 const rows = useQuery(
 api.menu.modifierRecipeMutations.listForModifier,
 token ? { token, modifierId } :"skip"
 ) as ModifierRecipeRow[] | undefined;
 const ingredients = useQuery(
 api.inventory.queries.listIngredients,
 token ? { token } :"skip"
 ) as (IngOpt & { stockQuantity: number | null })[] | undefined;

 const addRow = useMutation(api.menu.modifierRecipeMutations.addForModifier);
 const removeRow = useMutation(api.menu.modifierRecipeMutations.removeForModifier);

 const [ingId, setIngId] = useState<Id<"ingredients"> |"">("");
 const [qty, setQty] = useState(1);
 const [replacesId, setReplacesId] = useState<Id<"ingredients"> |"">("");
 const [variantKey, setVariantKey] = useState("");
 const [priceDisplay, setPriceDisplay] = useState("");
 const [busy, setBusy] = useState(false);
 const [err, setErr] = useState<string | null>(null);

 const typedRows = rows ?? [];
 const trimmedVariant = variantKey.trim();
 // Show ALL active ingredients in the dropdown — the server validates that
 // (ingredient + variantKey) is unique on Add. Filtering on the client used
 // to hide an ingredient if any row referenced it, which made size-aware
 // duplicates (e.g. Oat Milk for 330ml AND 500ml) impossible to add.
 const ingOptions = (ingredients ?? []).filter((i) => i.status ==="active");
 const replacesOptions = ingredients ?? [];

 const submit = async () => {
 if (!token || !ingId) return;
 setBusy(true);
 setErr(null);
 try {
 const priceCents =
 priceDisplay.trim() === ""
 ? undefined
 : Math.round(parseFloat(priceDisplay) * 100);
 if (priceCents !== undefined && !Number.isFinite(priceCents)) {
 throw new Error("Invalid price");
 }
 await addRow({
 token,
 modifierId,
 ingredientId: ingId as Id<"ingredients">,
 quantityUsed: qty,
 replacesIngredientId: replacesId ? (replacesId as Id<"ingredients">) : undefined,
 variantKey: trimmedVariant || undefined,
 priceAdjustment: priceCents,
 });
 setIngId("");
 setQty(1);
 setReplacesId("");
 setVariantKey("");
 setPriceDisplay("");
 } catch (e) {
 setErr(e instanceof Error ? e.message :"Failed to add");
 } finally {
 setBusy(false);
 }
 };

 return (
 <div
 className="ml-4 mt-1 mb-2 p-3 rounded-xl"
 style={{ backgroundColor:"var(--muted)", border:"1px solid var(--border-color)" }}
 >
 <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color:"var(--muted-fg)" }}>
 Ingredient deduction when this option is chosen
 </p>

 {err && (
 <p className="text-xs text-red-400 mb-2">{err}</p>
 )}

 {typedRows.length > 0 ? (
 <div className="flex flex-col gap-1 mb-3">
 {typedRows.map((r) => (
 <div key={r._id} className="flex items-center justify-between text-xs">
 <div style={{ color:"var(--fg)" }}>
 <strong>{r.quantityUsed}{r.ingredientUnit}</strong> {r.ingredientName}
 {r.variantKey && (
 <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor:"var(--card)", color:"var(--accent-color)" }}>
 only when: {r.variantKey}
 </span>
 )}
 {r.priceAdjustment !== null && r.variantKey && (
 <span className="ml-2 text-[11px] font-semibold" style={{ color:"var(--accent-color)" }}>
 price: {r.priceAdjustment >= 0 ? "+" : ""}P{(r.priceAdjustment / 100).toFixed(2)}
 </span>
 )}
 {r.replacesIngredientName && (
 <span className="ml-2 text-[11px]" style={{ color:"var(--muted-fg)" }}>
 (replaces {r.replacesIngredientName})
 </span>
 )}
 </div>
 <button
 onClick={() => token && removeRow({ token, rowId: r._id })}
 className="text-red-400 hover:text-red-300"
 >
 Remove
 </button>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-xs mb-3" style={{ color:"var(--muted-fg)" }}>
 No ingredients yet. Add at least one to deduct stock when this option is chosen.
 </p>
 )}

 {/* Add row — "Only when" first so operator scopes by size before picking
 ingredient + qty. Price overrides only fire when "Only when" is set. */}
 <div className="grid grid-cols-12 gap-2 items-end">
 <div className="col-span-2">
 <label className="block text-[10px] mb-1" style={{ color:"var(--muted-fg)" }}>
 Only when (optional)
 </label>
 <input
 type="text"
 value={variantKey}
 onChange={(e) => setVariantKey(e.target.value)}
 placeholder="e.g. 500ml"
 className="w-full rounded-lg px-2 py-1.5 text-xs"
 style={{ backgroundColor:"var(--card)", color:"var(--fg)", border:"1px solid var(--border-color)" }}
 />
 </div>
 <div className="col-span-3">
 <label className="block text-[10px] mb-1" style={{ color:"var(--muted-fg)" }}>
 Ingredient
 </label>
 <select
 value={ingId as string}
 onChange={(e) => setIngId(e.target.value as Id<"ingredients"> |"")}
 className="w-full rounded-lg px-2 py-1.5 text-xs"
 style={{ backgroundColor:"var(--card)", color:"var(--fg)", border:"1px solid var(--border-color)" }}
 >
 <option value="">Select…</option>
 {ingOptions.map((i) => (
 <option key={i._id} value={i._id}>
 {i.name} ({i.unit})
 </option>
 ))}
 </select>
 </div>
 <div className="col-span-1">
 <label className="block text-[10px] mb-1" style={{ color:"var(--muted-fg)" }}>
 Qty
 </label>
 <input
 type="number"
 step={0.01}
 min={0.01}
 value={qty}
 onChange={(e) => setQty(Number(e.target.value))}
 className="w-full rounded-lg px-2 py-1.5 text-xs"
 style={{ backgroundColor:"var(--card)", color:"var(--fg)", border:"1px solid var(--border-color)" }}
 />
 </div>
 <div className="col-span-2">
 <label className="block text-[10px] mb-1" style={{ color:"var(--muted-fg)" }}>
 Price ₱ (optional)
 </label>
 <input
 type="number"
 step={0.01}
 value={priceDisplay}
 onChange={(e) => setPriceDisplay(e.target.value)}
 placeholder="e.g. 30.00"
 disabled={!variantKey.trim()}
 title={!variantKey.trim() ? "Set 'Only when' first to enable per-variant price" : undefined}
 className="w-full rounded-lg px-2 py-1.5 text-xs disabled:opacity-40"
 style={{ backgroundColor:"var(--card)", color:"var(--fg)", border:"1px solid var(--border-color)" }}
 />
 </div>
 <div className="col-span-3">
 <label className="block text-[10px] mb-1" style={{ color:"var(--muted-fg)" }}>
 Replaces (optional)
 </label>
 <select
 value={replacesId as string}
 onChange={(e) => setReplacesId(e.target.value as Id<"ingredients"> |"")}
 className="w-full rounded-lg px-2 py-1.5 text-xs"
 style={{ backgroundColor:"var(--card)", color:"var(--fg)", border:"1px solid var(--border-color)" }}
 >
 <option value="">— none —</option>
 {replacesOptions.map((i) => (
 <option key={i._id} value={i._id}>
 {i.name}
 </option>
 ))}
 </select>
 </div>
 <div className="col-span-1">
 <button
 onClick={submit}
 disabled={!ingId || busy}
 className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
 style={{ backgroundColor:"var(--accent-color)" }}
 >
 Add
 </button>
 </div>
 </div>
 <p className="text-[10px] mt-2" style={{ color:"var(--muted-fg)" }}>
 Tips · <em>Replaces</em>: swap a base ingredient (Oat Milk replaces Regular Milk). ·{" "}
 <em>Only when</em>: type a size modifier name (e.g. <code>500ml</code>) to make this row size-specific. ·{" "}
 <em>Price</em>: only honored when <em>Only when</em> is set — overrides the modifier's own price for that size (e.g. Oat Milk +₱20 on 330ml, +₱30 on 500ml).
 </p>
 </div>
 );
}
