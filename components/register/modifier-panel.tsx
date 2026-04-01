"use client";

import { useQuery } from"convex/react";
import { api } from"../../convex/_generated/api";
import { Id } from"../../convex/_generated/dataModel";
import { useState, useCallback, useMemo } from"react";

type Modifier = {
 _id: string;
 name: string;
 priceAdjustment: number;
 status: string;
 sortOrder: number;
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

 // Map of groupId -> Set of selected modifier ids
 const [selections, setSelections] = useState<Record<string, Set<string>>>({});
 const [validationErrors, setValidationErrors] = useState<Set<string>>(
 new Set()
 );

 const toggleModifier = useCallback(
 (group: ModifierGroup, modifierId: string) => {
 setSelections((prev) => {
 const current = prev[group._id] ?? new Set<string>();
 const next = new Set(current);

 if (group.maxSelect === 1) {
 // Single-select: radio behavior
 if (next.has(modifierId)) {
 next.delete(modifierId);
 } else {
 next.clear();
 next.add(modifierId);
 }
 } else {
 // Multi-select: toggle
 if (next.has(modifierId)) {
 next.delete(modifierId);
 } else {
 if (next.size < group.maxSelect) {
 next.add(modifierId);
 }
 }
 }

 return { ...prev, [group._id]: next };
 });

 // Clear validation error for this group on interaction
 setValidationErrors((prev) => {
 if (!prev.has(group._id)) return prev;
 const next = new Set(prev);
 next.delete(group._id);
 return next;
 });
 },
 []
 );

 const modifierTotal = useMemo(() => {
 if (!groups) return 0;
 let total = 0;
 for (const group of groups) {
 const selected = selections[group._id];
 if (!selected) continue;
 for (const mod of group.modifiers) {
 if (selected.has(mod._id)) {
 total += mod.priceAdjustment;
 }
 }
 }
 return total;
 }, [groups, selections]);

 const runningTotal = effectivePrice + modifierTotal;

 const handleConfirm = useCallback(() => {
 if (!groups) return;

 // Validate required groups
 const errors = new Set<string>();
 for (const group of groups) {
 if (group.required) {
 const selected = selections[group._id];
 const count = selected?.size ?? 0;
 if (count < group.minSelect) {
 errors.add(group._id);
 }
 }
 }

 if (errors.size > 0) {
 setValidationErrors(errors);
 return;
 }

 // Build modifier payload
 const modifiers: Array<{ modifierName: string; priceAdjustment: number }> =
 [];
 for (const group of groups) {
 const selected = selections[group._id];
 if (!selected) continue;
 for (const mod of group.modifiers) {
 if (selected.has(mod._id)) {
 modifiers.push({
 modifierName: mod.name,
 priceAdjustment: mod.priceAdjustment,
 });
 }
 }
 }

 onConfirm({ modifiers });
 }, [groups, selections, onConfirm]);

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
 const isSelected = selected.has(mod._id);
 return (
 <button
 key={mod._id}
 onClick={() => toggleModifier(group, mod._id)}
 className={`min-h-[48px] p-3 rounded-2xl border-2 text-left transition-colors ${
 isSelected
 ?"border-amber-500 bg-amber-500/10"
 : hasError
 ?"border-red-500/20"
 :""
 }`}
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
 {mod.priceAdjustment !== 0 && (
 <span className="text-xs mt-0.5 block">
 {mod.priceAdjustment > 0 ?"+" :""}
 {formatPrice(mod.priceAdjustment)}
 </span>
 )}
 </button>
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
