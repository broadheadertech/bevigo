"use client";

import { useState } from"react";
import { useQuery, useMutation } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

type LocationInfo = {
 _id: Id<"locations">;
 name: string;
};

type PriceOverridePanelProps = {
 menuItemId: Id<"menuItems">;
};

export function PriceOverridePanel({ menuItemId }: PriceOverridePanelProps) {
 const { token } = useAuth();

 const pricing = useQuery(
 api.menu.priceQueries.getItemPricing,
 token ? { token, menuItemId } :"skip"
 );

 const setPriceOverride = useMutation(
 api.menu.priceMutations.setPriceOverride
 );
 const removePriceOverride = useMutation(
 api.menu.priceMutations.removePriceOverride
 );

 const [editingLocationId, setEditingLocationId] =
 useState<Id<"locations"> | null>(null);
 const [priceInput, setPriceInput] = useState("");
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 if (!pricing) {
 return (
 <div className="p-4 text-sm">Loading pricing data...</div>
 );
 }

 // Build a map of locationId -> override price for quick lookup
 const overrideMap = new Map<string, number>();
 for (const o of pricing.overrides) {
 overrideMap.set(o.locationId, o.price);
 }

 const formatPrice = (cents: number) => (cents / 100).toFixed(2);

 const handleEditClick = (locationId: Id<"locations">, currentPrice: number) => {
 setEditingLocationId(locationId);
 setPriceInput(formatPrice(currentPrice));
 setError(null);
 };

 const handleCancelEdit = () => {
 setEditingLocationId(null);
 setPriceInput("");
 setError(null);
 };

 const handleSaveOverride = async (locationId: Id<"locations">) => {
 if (!token) return;

 const price = Math.round(parseFloat(priceInput) * 100);
 if (isNaN(price) || price <= 0) {
 setError("Please enter a valid price greater than 0");
 return;
 }

 setIsSubmitting(true);
 setError(null);

 try {
 await setPriceOverride({ token, menuItemId, locationId, price });
 setEditingLocationId(null);
 setPriceInput("");
 } catch (err) {
 setError(err instanceof Error ? err.message :"Failed to set override");
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleRemoveOverride = async (locationId: Id<"locations">) => {
 if (!token) return;

 setIsSubmitting(true);
 setError(null);

 try {
 await removePriceOverride({ token, menuItemId, locationId });
 } catch (err) {
 setError(
 err instanceof Error ? err.message :"Failed to remove override"
 );
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="border rounded-2xl p-4">
 <h3 className="text-sm font-semibold text-gray-800 mb-1" style={{ color: 'var(--fg)' }}>
 Location Price Overrides
 </h3>
 <p className="text-xs mb-3">
 Base price: {formatPrice(pricing.basePrice)}. Override per location
 below.
 </p>

 {error && (
 <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs">
 {error}
 </div>
 )}

 {pricing.locations.length === 0 ? (
 <p className="text-sm">No active locations found.</p>
 ) : (
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b" style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <th className="text-left py-2 pr-4 font-medium">
 Location
 </th>
 <th className="text-right py-2 pr-4 font-medium">
 Effective Price
 </th>
 <th className="text-right py-2 font-medium">
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {pricing.locations.map((location: LocationInfo) => {
 const override = overrideMap.get(location._id);
 const hasOverride = override !== undefined;
 const effectivePrice = override ?? pricing.basePrice;
 const isEditing = editingLocationId === location._id;

 return (
 <tr
 key={location._id}
 className="border-b last:border-b-0"
 >
 <td className="py-2 pr-4 text-gray-800">{location.name}</td>
 <td className="py-2 pr-4 text-right">
 {isEditing ? (
 <input
 type="number"
 min="0.01"
 step="0.01"
 value={priceInput}
 onChange={(e) => setPriceInput(e.target.value)}
 className="w-28 border rounded px-2 py-1 text-right text-sm"
 placeholder="150.00"
 autoFocus
 onKeyDown={(e) => {
 if (e.key ==="Enter") {
 handleSaveOverride(location._id);
 } else if (e.key ==="Escape") {
 handleCancelEdit();
 }
 }}
 />
 ) : (
 <span
 className={hasOverride ?"font-medium text-blue-400" :""}
 >
 {formatPrice(effectivePrice)}
 {!hasOverride && (
 <span className="ml-1 text-xs">
 (base)
 </span>
 )}
 </span>
 )}
 </td>
 <td className="py-2 text-right">
 {isEditing ? (
 <span className="inline-flex gap-1">
 <button
 type="button"
 disabled={isSubmitting}
 onClick={() => handleSaveOverride(location._id)}
 className="px-2 py-1 text-xs text-white rounded disabled:opacity-50"
 >
 {isSubmitting ?"..." :"Save"}
 </button>
 <button
 type="button"
 onClick={handleCancelEdit}
 className="px-2 py-1 text-xs border rounded"
 >
 Cancel
 </button>
 </span>
 ) : (
 <span className="inline-flex gap-1">
 <button
 type="button"
 onClick={() =>
 handleEditClick(location._id, effectivePrice)
 }
 className="px-2 py-1 text-xs borderlue-200 rounded hover:bg-blue-500/10"
 >
 {hasOverride ?"Edit" :"Set Override"}
 </button>
 {hasOverride && (
 <button
 type="button"
 disabled={isSubmitting}
 onClick={() =>
 handleRemoveOverride(location._id)
 }
 className="px-2 py-1 text-xs text-red-400 border border-red-500/20 rounded hover:bg-red-500/10 disabled:opacity-50"
 >
 Remove
 </button>
 )}
 </span>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 )}
 </div>
 );
}
