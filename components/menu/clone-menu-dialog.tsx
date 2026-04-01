"use client";

import { useState } from"react";
import { useQuery, useMutation } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

type LocationInfo = {
 _id: Id<"locations">;
 name: string;
 slug: string;
 status: string;
};

type SourceOverride = {
 menuItemId: string;
 itemName: string;
 price: number;
};

type Conflict = {
 menuItemId: string;
 itemName: string;
 sourcePrice: number;
 targetPrice: number;
};

type CloneMenuDialogProps = {
 onClose: () => void;
};

export function CloneMenuDialog({ onClose }: CloneMenuDialogProps) {
 const { token } = useAuth();

 const [sourceLocationId, setSourceLocationId] = useState<
 Id<"locations"> |""
 >("");
 const [targetLocationId, setTargetLocationId] = useState<
 Id<"locations"> |""
 >("");
 const [overwriteConflicts, setOverwriteConflicts] = useState(false);
 const [step, setStep] = useState<"select" |"preview" |"done">("select");
 const [isCloning, setIsCloning] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [result, setResult] = useState<{
 created: number;
 updated: number;
 skipped: number;
 } | null>(null);

 const locationData = useQuery(
 api.settings.queries.listLocations,
 token ? { token } :"skip"
 );

 const preview = useQuery(
 api.menu.cloneMutations.previewClone,
 token && sourceLocationId && targetLocationId
 ? {
 token,
 sourceLocationId: sourceLocationId as Id<"locations">,
 targetLocationId: targetLocationId as Id<"locations">,
 }
 :"skip"
 );

 const cloneMenuMutation = useMutation(api.menu.cloneMutations.cloneMenu);

 const locationsList = (locationData ?? []) as LocationInfo[];

 const canPreview =
 sourceLocationId && targetLocationId && sourceLocationId !== targetLocationId;

 const handlePreview = () => {
 if (!canPreview) return;
 setError(null);
 setStep("preview");
 };

 const handleClone = async () => {
 if (!token || !sourceLocationId || !targetLocationId) return;

 setIsCloning(true);
 setError(null);

 try {
 const res = await cloneMenuMutation({
 token,
 sourceLocationId: sourceLocationId as Id<"locations">,
 targetLocationId: targetLocationId as Id<"locations">,
 overwriteConflicts,
 });
 setResult(res);
 setStep("done");
 } catch (err) {
 setError(err instanceof Error ? err.message :"An error occurred");
 } finally {
 setIsCloning(false);
 }
 };

 const formatPrice = (cents: number) => {
 return (cents / 100).toFixed(2);
 };

 return (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>Clone Menu Pricing</h2>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-sm">
 {error}
 </div>
 )}

 {step ==="select" && (
 <div className="flex flex-col gap-4">
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Source Location
 </label>
 <select
 value={sourceLocationId}
 onChange={(e) =>
 setSourceLocationId(e.target.value as Id<"locations"> |"")
 }
 className="w-full border rounded px-3 py-2"
 >
 <option value="">Select source location...</option>
 {locationsList.map((loc) => (
 <option key={loc._id} value={loc._id}>
 {loc.name}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Target Location
 </label>
 <select
 value={targetLocationId}
 onChange={(e) =>
 setTargetLocationId(e.target.value as Id<"locations"> |"")
 }
 className="w-full border rounded px-3 py-2"
 >
 <option value="">Select target location...</option>
 {locationsList
 .filter((loc) => loc._id !== sourceLocationId)
 .map((loc) => (
 <option key={loc._id} value={loc._id}>
 {loc.name}
 </option>
 ))}
 </select>
 </div>

 {sourceLocationId &&
 targetLocationId &&
 sourceLocationId === targetLocationId && (
 <p className="text-sm text-red-600">
 Source and target locations must be different.
 </p>
 )}

 <p className="text-sm">
 This will copy all location-specific price overrides from the
 source to the target location.
 </p>

 <div className="flex justify-end gap-3 mt-2">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 border rounded-2xl"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handlePreview}
 disabled={!canPreview}
 className="px-4 py-2 text-white rounded-2xl disabled:opacity-50"
 >
 Preview
 </button>
 </div>
 </div>
 )}

 {step ==="preview" && (
 <div className="flex flex-col gap-4 overflow-hidden">
 {preview === undefined ? (
 <p style={{ color: 'var(--muted-fg)' }}>Loading preview...</p>
 ) : (
 <>
 <div className="overflow-y-auto flex-1">
 <h3 className="text-sm font-medium mb-2">
 Price overrides to copy ({preview.sourceOverrides.length})
 </h3>

 {preview.sourceOverrides.length === 0 ? (
 <p className="text-sm">
 No price overrides found at the source location.
 </p>
 ) : (
 <div className="border rounded overflow-hidden mb-4">
 <table className="w-full text-sm">
 <thead className="bg-gray-50" style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <tr>
 <th className="text-left px-3 py-2 font-medium">
 Item
 </th>
 <th className="text-right px-3 py-2 font-medium">
 Price
 </th>
 </tr>
 </thead>
 <tbody>
 {preview.sourceOverrides.map((o: SourceOverride) => (
 <tr
 key={o.menuItemId}
 className="border-t"
 >
 <td className="px-3 py-2">{o.itemName}</td>
 <td className="px-3 py-2 text-right">
 ${formatPrice(o.price)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {preview.conflicts.length > 0 && (
 <>
 <h3 className="text-sm font-medium text-amber-400 mb-2">
 Conflicts ({preview.conflicts.length})
 </h3>
 <p className="text-xs mb-2">
 These items already have price overrides at the target
 location.
 </p>
 <div className="border border-amber-500/20 rounded overflow-hidden mb-4">
 <table className="w-full text-sm">
 <thead className="bg-amber-50" style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <tr>
 <th className="text-left px-3 py-2 font-medium text-amber-400">
 Item
 </th>
 <th className="text-right px-3 py-2 font-medium text-amber-400">
 Source
 </th>
 <th className="text-right px-3 py-2 font-medium text-amber-400">
 Target
 </th>
 </tr>
 </thead>
 <tbody>
 {preview.conflicts.map((c: Conflict) => (
 <tr
 key={c.menuItemId}
 className="border-t border-amber-500/10"
 >
 <td className="px-3 py-2">{c.itemName}</td>
 <td className="px-3 py-2 text-right">
 ${formatPrice(c.sourcePrice)}
 </td>
 <td className="px-3 py-2 text-right">
 ${formatPrice(c.targetPrice)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <label className="flex items-center gap-2 text-sm">
 <input
 type="checkbox"
 checked={overwriteConflicts}
 onChange={(e) =>
 setOverwriteConflicts(e.target.checked)
 }
 className="rounded"
 />
 <span>Overwrite existing prices at target location</span>
 </label>
 </>
 )}
 </div>

 <div className="flex justify-end gap-3 mt-2">
 <button
 type="button"
 onClick={() => {
 setStep("select");
 setOverwriteConflicts(false);
 }}
 className="px-4 py-2 border rounded-2xl"
 >
 Back
 </button>
 <button
 type="button"
 onClick={handleClone}
 disabled={
 isCloning || preview.sourceOverrides.length === 0
 }
 className="px-4 py-2 text-white rounded-2xl disabled:opacity-50"
 >
 {isCloning ?"Cloning..." :"Clone Prices"}
 </button>
 </div>
 </>
 )}
 </div>
 )}

 {step ==="done" && result && (
 <div className="flex flex-col gap-4">
 <div className="p-4 bg-green-500/10 border border-green-500/20 rounded">
 <p className="text-green-400 font-medium mb-2">
 Clone completed successfully!
 </p>
 <ul className="text-sm text-green-400 space-y-1">
 <li>Created: {result.created} price override(s)</li>
 <li>Updated: {result.updated} price override(s)</li>
 <li>Skipped: {result.skipped} conflicting override(s)</li>
 </ul>
 </div>

 <div className="flex justify-end">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 text-white rounded-2xl"
 >
 Done
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
