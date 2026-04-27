"use client";

import { useQuery } from"convex/react";
import { api } from"../../convex/_generated/api";
import { Id } from"../../convex/_generated/dataModel";
import { useEffect, useState, useCallback, useMemo } from"react";

type Modifier = {
 _id: string;
 name: string;
 priceAdjustment: number;
 status: string;
 sortOrder: number;
 isDefault?: boolean;
 /** Per-variant price overrides keyed by another modifier's name. */
 priceOverrides?: Array<{ variantKey: string; priceAdjustment: number }>;
};

type ModifierGroup = {
 _id: string;
 name: string;
 required: boolean;
 minSelect: number;
 maxSelect: number;
 modifiers: Modifier[];
};

type ConfirmPayload = {
 modifiers: Array<{ modifierName: string; priceAdjustment: number }>;
};

type ModifierPanelProps = {
 menuItemId: Id<"menuItems">;
 itemName: string;
 effectivePrice: number;
 onConfirm: (payload: ConfirmPayload) => void;
 onCancel: () => void;
 token: string;
};

function formatPrice(cents: number): string {
 return (cents / 100).toFixed(2);
}

export function ModifierPanel({
 menuItemId,
 itemName,
 effectivePrice,
 onConfirm,
 onCancel,
 token,
}: ModifierPanelProps) {
 const groups = useQuery(
 api.menu.modifierQueries.getItemModifierGroups,
 { token, menuItemId }
 ) as ModifierGroup[] | undefined;

 // groupId -> (modifierId -> qty). Absence or qty=0 = unselected.
 const [selections, setSelections] = useState<
 Record<string, Record<string, number>>
 >({});
 const [defaultsHydrated, setDefaultsHydrated] = useState(false);
 const [validationErrors, setValidationErrors] = useState<Set<string>>(
 new Set()
 );

 // Pre-select defaults once groups arrive
 useEffect(() => {
 if (defaultsHydrated || !groups) return;
 const initial: Record<string, Record<string, number>> = {};
 for (const group of groups) {
 const defaults = group.modifiers.filter(
 (m) => m.status ==="active" && m.isDefault
 );
 if (defaults.length > 0) {
 const map: Record<string, number> = {};
 for (const d of defaults) map[d._id] = 1;
 initial[group._id] = map;
 }
 }
 setSelections(initial);
 setDefaultsHydrated(true);
 }, [groups, defaultsHydrated]);

 const clearGroupError = (groupId: string) => {
 setValidationErrors((prev) => {
 if (!prev.has(groupId)) return prev;
 const next = new Set(prev);
 next.delete(groupId);
 return next;
 });
 };

 const toggleModifier = useCallback(
 (group: ModifierGroup, modifierId: string) => {
 setSelections((prev) => {
 const current = prev[group._id] ?? {};
 const isSelected = (current[modifierId] ?? 0) > 0;

 if (group.maxSelect === 1) {
 // Single-select: radio behavior — picking one clears the rest
 if (isSelected) return { ...prev, [group._id]: {} };
 return { ...prev, [group._id]: { [modifierId]: 1 } };
 }

 // Multi-select: toggle this modifier on/off at qty 1
 const next = { ...current };
 if (isSelected) {
 delete next[modifierId];
 } else {
 const distinctSelected = Object.keys(next).length;
 if (distinctSelected < group.maxSelect) next[modifierId] = 1;
 }
 return { ...prev, [group._id]: next };
 });
 clearGroupError(group._id);
 },
 []
 );

 const adjustQty = useCallback(
 (groupId: string, modifierId: string, delta: number) => {
 setSelections((prev) => {
 const current = prev[groupId] ?? {};
 const qty = current[modifierId] ?? 0;
 if (qty === 0) return prev; // can't adjust an unselected modifier
 const nextQty = Math.max(1, Math.min(20, qty + delta));
 return { ...prev, [groupId]: { ...current, [modifierId]: nextQty } };
 });
 },
 []
 );

 // Names of every selected modifier — used to look up variant-specific
 // price overrides (e.g. Oat Milk costs +20 on 330ml but +30 on 500ml).
 const chosenNames = useMemo(() => {
 if (!groups) return new Set<string>();
 const set = new Set<string>();
 for (const group of groups) {
 const sel = selections[group._id];
 if (!sel) continue;
 for (const mod of group.modifiers) {
 if ((sel[mod._id] ?? 0) > 0) set.add(mod.name);
 }
 }
 return set;
 }, [groups, selections]);

 const modPrice = useCallback(
 (mod: Modifier): number => {
 const overrides = mod.priceOverrides ?? [];
 for (const o of overrides) {
 // Self-referential overrides (variantKey === own name) would always
 // fire as soon as the option is clicked, zeroing-out a legitimate
 // priceAdjustment. They're meaningless anyway — an option's price
 // for itself is just its priceAdjustment — so ignore them.
 if (o.variantKey === mod.name) continue;
 if (chosenNames.has(o.variantKey)) return o.priceAdjustment;
 }
 return mod.priceAdjustment;
 },
 [chosenNames]
 );

 const modifierTotal = useMemo(() => {
 if (!groups) return 0;
 let total = 0;
 for (const group of groups) {
 const selected = selections[group._id];
 if (!selected) continue;
 for (const mod of group.modifiers) {
 const qty = selected[mod._id] ?? 0;
 if (qty > 0) total += modPrice(mod) * qty;
 }
 }
 return total;
 }, [groups, selections, modPrice]);

 const runningTotal = effectivePrice + modifierTotal;

 const handleConfirm = useCallback(() => {
 if (!groups) return;

 // Validate required groups (count distinct modifiers selected, not qty)
 const errors = new Set<string>();
 for (const group of groups) {
 if (group.required) {
 const selected = selections[group._id] ?? {};
 const count = Object.keys(selected).length;
 if (count < group.minSelect) errors.add(group._id);
 }
 }

 if (errors.size > 0) {
 setValidationErrors(errors);
 return;
 }

 // Emit one row per qty so the existing server-side ingredient deduction
 // (which loops over orderItemModifiers) multiplies correctly.
 const modifiers: Array<{ modifierName: string; priceAdjustment: number }> =
 [];
 for (const group of groups) {
 const selected = selections[group._id];
 if (!selected) continue;
 for (const mod of group.modifiers) {
 const qty = selected[mod._id] ?? 0;
 const price = modPrice(mod);
 for (let i = 0; i < qty; i++) {
 modifiers.push({
 modifierName: mod.name,
 priceAdjustment: price,
 });
 }
 }
 }

 onConfirm({ modifiers });
 }, [groups, selections, onConfirm, modPrice]);

 const isLoading = groups === undefined;

 return (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
 {/* Backdrop */}
 <div
 className="absolute inset-0 bg-black/50"
 onClick={onCancel}
 />

 {/* Panel */}
 <div className="relative w-full max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col animate-slide-up shadow-2xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3">
 <div>
 <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>{itemName}</h2>
 <p className="text-sm">
 Base: {formatPrice(effectivePrice)}
 </p>
 </div>
 <button
 onClick={onCancel}
 className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl transition-colors"
 aria-label="Cancel"
 >
 <svg
 className="w-6 h-6"
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
 </div>

 {/* Scrollable modifier groups */}
 <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
 {isLoading && (
 <div className="flex items-center justify-center py-12">
 <p className="text-stone-400 text-sm">Loading modifiers...</p>
 </div>
 )}

 {groups &&
 groups.map((group) => {
 const hasError = validationErrors.has(group._id);
 const selected = selections[group._id] ?? new Set<string>();
 const activeModifiers = group.modifiers.filter(
 (m) => m.status ==="active"
 );

 return (
 <div key={group._id}>
 <div className="flex items-center gap-2 mb-2">
 <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
 {group.name}
 </h3>
 {group.required && (
 <span
 className={`text-xs font-medium px-2 py-0.5 rounded-full ${
 hasError
 ?"bg-red-500/15 text-red-400"
 :"bg-amber-500/15 text-amber-400"
 }`}
 >
 Required
 </span>
 )}
 {group.maxSelect > 1 && (
 <span className="text-xs">
 (max {group.maxSelect})
 </span>
 )}
 </div>
 {hasError && (
 <p className="text-xs text-red-600 mb-2">
 Please select at least {group.minSelect} option
 {group.minSelect > 1 ?"s" :""}
 </p>
 )}
 <div className="grid grid-cols-2 gap-2">
 {activeModifiers.map((mod) => {
 const qty = selected[mod._id] ?? 0;
 const isSelected = qty > 0;
 // Qty steppers don't apply to single-select (radio) groups.
 const showStepper = isSelected && group.maxSelect > 1;
 return (
 <div
 key={mod._id}
 className={`min-h-[48px] rounded-2xl border-2 transition-colors ${
 isSelected
 ?"border-amber-500 bg-amber-500/10"
 : hasError
 ?"border-red-500/20"
 :""
 }`}
 >
 <button
 onClick={() => toggleModifier(group, mod._id)}
 className="w-full text-left p-3"
 >
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">
 {mod.name}
 </span>
 {isSelected && (
 <svg
 className="w-5 h-5 text-amber-600 flex-shrink-0"
 fill="currentColor"
 viewBox="0 0 20 20"
 >
 <path
 fillRule="evenodd"
 d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
 clipRule="evenodd"
 />
 </svg>
 )}
 </div>
 {(() => {
 const p = modPrice(mod);
 if (p === 0) return null;
 return (
 <span className="text-xs mt-0.5 block">
 {p > 0 ?"+" :""}
 {formatPrice(p)}
 {qty > 1 && (
 <span className="ml-1 opacity-70">× {qty}</span>
 )}
 </span>
 );
 })()}
 </button>
 {showStepper && (
 <div
 className="flex items-center justify-between px-3 py-2 mt-1"
 style={{ borderTop:"1px solid var(--border-color)" }}
 >
 <span className="text-[11px]" style={{ color:"var(--muted-fg)" }}>
 Qty
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={(e) => {
 e.stopPropagation();
 adjustQty(group._id, mod._id, -1);
 }}
 disabled={qty <= 1}
 className="w-7 h-7 rounded-lg text-sm font-bold disabled:opacity-30"
 style={{ backgroundColor:"var(--muted)", color:"var(--fg)" }}
 aria-label="Decrease quantity"
 >
 −
 </button>
 <span className="min-w-[1.5rem] text-center text-sm font-semibold" style={{ color:"var(--fg)" }}>
 {qty}
 </span>
 <button
 onClick={(e) => {
 e.stopPropagation();
 adjustQty(group._id, mod._id, +1);
 }}
 className="w-7 h-7 rounded-lg text-sm font-bold"
 style={{ backgroundColor:"var(--accent-color)", color:"white" }}
 aria-label="Increase quantity"
 >
 +
 </button>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
 })}

 {groups && groups.length === 0 && (
 <div className="flex items-center justify-center py-12">
 <p className="text-stone-400 text-sm">
 No modifiers available for this item.
 </p>
 </div>
 )}
 </div>

 {/* Footer with running total and actions */}
 <div className="border-t px-4 py-3 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm">Total</span>
 <span className="text-lg font-bold">
 {formatPrice(runningTotal)}
 </span>
 </div>
 <div className="flex gap-3">
 <button
 onClick={onCancel}
 className="flex-1 min-h-[48px] px-4 py-3 rounded-2xl border border-stone-300 font-medium active:bg-stone-500/10 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleConfirm}
 disabled={isLoading}
 className="flex-1 min-h-[48px] px-4 py-3 rounded-2xl bg-amber-600 text-white font-medium hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 Add to Order
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
