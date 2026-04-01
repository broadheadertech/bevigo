"use client";

import { useQuery } from"convex/react";
import { api } from"../../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState } from"react";
import { Id } from"../../../../convex/_generated/dataModel";
import { AdjustmentForm } from"@/components/inventory/adjustment-form";

type Location = {
 _id: Id<"locations">;
 name: string;
 slug: string;
 status: string;
};

type StockAdjustment = {
 _id: Id<"stockAdjustments">;
 ingredientId: Id<"ingredients">;
 locationId: Id<"locations">;
 tenantId: Id<"tenants">;
 userId: Id<"users">;
 type:"wastage" |"correction" |"stocktake" |"transfer";
 quantity: number;
 reason: string;
 createdAt: number;
 ingredientName: string;
 ingredientUnit: string;
 locationName: string;
 userName: string;
};

const TYPE_STYLES: Record<string, string> = {
 wastage:"bg-red-500/15 text-red-400",
 correction:"bg-blue-500/15 text-blue-400",
 stocktake:"bg-purple-500/15 text-purple-400",
 transfer:"bg-amber-500/15 text-amber-400",
};

const ADJUSTMENT_TYPES = [
 { value:"", label:"All Types" },
 { value:"wastage", label:"Wastage" },
 { value:"correction", label:"Correction" },
 { value:"stocktake", label:"Stocktake" },
 { value:"transfer", label:"Transfer" },
] as const;

function formatDate(ts: number) {
 return new Date(ts).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 hour:"2-digit",
 minute:"2-digit",
 });
}

export default function AdjustmentsPage() {
 const { session, token } = useAuth();

 const [typeFilter, setTypeFilter] = useState<string>("");
 const [locationFilter, setLocationFilter] = useState<string>("");
 const [showForm, setShowForm] = useState(false);

 const locations = useQuery(
 api.settings.queries.listLocations,
 token ? { token } :"skip"
 ) as Location[] | undefined;

 const adjustments = useQuery(
 api.inventory.adjustmentQueries.listAdjustments,
 token
 ? {
 token,
 ...(typeFilter
 ? {
 type: typeFilter as
 |"wastage"
 |"correction"
 |"stocktake"
 |"transfer",
 }
 : {}),
 ...(locationFilter
 ? { locationId: locationFilter as Id<"locations"> }
 : {}),
 }
 :"skip"
 ) as StockAdjustment[] | undefined;

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 const activeLocations = (locations ?? []).filter(
 (l: Location) => l.status ==="active"
 );

 return (
 <div>
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>
 Stock Adjustments
 </h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
 Track wastage, corrections, stocktakes, and transfers
 </p>
 </div>
 <button
 onClick={() => setShowForm(true)}
 className="px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg" style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
 >
 + Log Adjustment
 </button>
 </div>

 {/* Filters */}
 <div className="flex gap-4 mb-6">
 <div className="flex gap-2">
 {ADJUSTMENT_TYPES.map(
 (t: { value: string; label: string }) => (
 <button
 key={t.value}
 onClick={() => setTypeFilter(t.value)}
 className="px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
 style={typeFilter === t.value
  ? { backgroundColor: 'var(--accent-color)', color: 'white' }
  : { backgroundColor: 'var(--muted)', color: 'var(--muted-fg)' }
 }
 >
 {t.label}
 </button>
 )
 )}
 </div>
 {activeLocations.length > 1 && (
 <select
 value={locationFilter}
 onChange={(e) => setLocationFilter(e.target.value)}
 className="border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">All Locations</option>
 {activeLocations.map((loc: Location) => (
 <option key={loc._id} value={loc._id}>
 {loc.name}
 </option>
 ))}
 </select>
 )}
 </div>

 {/* Adjustments table */}
 {adjustments === undefined ? (
 <div className="flex items-center justify-center h-48">
 <p style={{ color: 'var(--muted-fg)' }}>Loading adjustments...</p>
 </div>
 ) : adjustments.length === 0 ? (
 <div className="flex items-center justify-center h-48">
 <p style={{ color: 'var(--muted-fg)' }}>
 No adjustments recorded yet.
 </p>
 </div>
 ) : (
 <div className="rounded-2xl border shadow-lg overflow-hidden">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b" style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide">
 Date
 </th>
 <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide">
 Ingredient
 </th>
 <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide">
 Type
 </th>
 <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide">
 Quantity
 </th>
 <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide">
 Reason
 </th>
 <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide">
 Location
 </th>
 <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide">
 User
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-stone-100">
 {adjustments.map((adj: StockAdjustment) => (
 <tr key={adj._id} className="hover:">
 <td className="px-4 py-3 whitespace-nowrap">
 {formatDate(adj.createdAt)}
 </td>
 <td className="px-4 py-3 font-medium" style={{ color: 'var(--fg)' }}>
 {adj.ingredientName}
 <span className="text-stone-400 ml-1 text-xs font-normal">
 {adj.ingredientUnit}
 </span>
 </td>
 <td className="px-4 py-3">
 <span
 className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[adj.type] ??"bg-stone-500/10"}`}
 >
 {adj.type.charAt(0).toUpperCase() +
 adj.type.slice(1)}
 </span>
 </td>
 <td
 className={`px-4 py-3 text-right font-medium ${
 adj.quantity < 0
 ?"text-red-600"
 :"text-emerald-600"
 }`}
 >
 {adj.quantity > 0 ?"+" :""}
 {adj.quantity}
 </td>
 <td className="px-4 py-3 max-w-[200px] truncate">
 {adj.reason}
 </td>
 <td className="px-4 py-3">
 {adj.locationName}
 </td>
 <td className="px-4 py-3">
 {adj.userName}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Adjustment Form Modal */}
 {showForm && (
 <AdjustmentForm
 locations={activeLocations}
 onClose={() => setShowForm(false)}
 />
 )}
 </div>
 );
}
