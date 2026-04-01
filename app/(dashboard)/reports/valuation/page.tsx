"use client";

import { useQuery } from"convex/react";
import { api } from"../../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useMemo } from"react";
import { Id } from"../../../../convex/_generated/dataModel";
import { exportToCSV } from"@/lib/export";
import { formatCurrency } from"@/lib/currency";

type LocationOption = {
 _id: Id<"locations">;
 name: string;
 slug: string;
 status: string;
};

type ValuationItem = {
 ingredientName: string;
 unit: string;
 category: string;
 stock: number;
 avgUnitCost: number;
 totalValue: number;
};

type ValuationResult = {
 items: ValuationItem[];
 grandTotal: number;
};

export default function ValuationPage() {
 const { session, token } = useAuth();
 const [selectedLocationId, setSelectedLocationId] = useState<string>("");

 const locationId = selectedLocationId
 ? (selectedLocationId as Id<"locations">)
 : undefined;

 const locations = useQuery(
 api.settings.queries.listLocations,
 token ? { token } :"skip"
 ) as LocationOption[] | undefined;

 const availableLocations = useMemo(() => {
 if (!locations || !session) return [];
 if (session.role ==="owner") return locations;
 return locations.filter((loc: LocationOption) =>
 session.locationIds.includes(loc._id)
 );
 }, [locations, session]);

 const valuationData = useQuery(
 api.reports.queries.inventoryValuation,
 token ? { token, locationId } :"skip"
 ) as ValuationResult | undefined;

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 return (
 <div>
 <div className="mb-8">
 <h1 className="text-lg md:text-xl font-bold" style={{ color: 'var(--fg)' }}>
 Inventory Valuation
 </h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
 Current stock value based on average purchase costs
 </p>
 </div>

 {/* Filter Bar */}
 <div className="rounded-2xl border shadow-lg p-4 mb-6">
 <div className="flex flex-wrap gap-4 items-end">
 <div>
 <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Location
 </label>
 <select
 value={selectedLocationId}
 onChange={(e) => setSelectedLocationId(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">All Locations</option>
 {availableLocations.map((loc: LocationOption) => (
 <option key={loc._id} value={loc._id}>
 {loc.name}
 </option>
 ))}
 </select>
 </div>
 <button
 onClick={() => {
 if (!valuationData) return;
 exportToCSV(
 valuationData.items.map((r: ValuationItem) => ({
 Ingredient: r.ingredientName,
 Unit: r.unit,
 Category: r.category,
 Stock: r.stock,
"Avg Unit Cost": r.avgUnitCost,
"Total Value": r.totalValue,
 })),
"inventory-valuation.csv"
 );
 }}
 className="px-3 py-2 text-sm rounded-xl"
 >
 Export CSV
 </button>
 </div>
 </div>

 {/* Grand total card */}
 {valuationData && (
 <div className="rounded-2xl border shadow-lg p-5 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <p className="text-xs font-medium uppercase tracking-wide mb-1">
 Total Inventory Value
 </p>
 <p className="text-2xl font-bold">
 {formatCurrency(valuationData.grandTotal)}
 </p>
 <p className="text-sm mt-1">
 {valuationData.items.length} ingredient{valuationData.items.length !== 1 ?"s" :""} in stock
 </p>
 </div>
 )}

 {/* Table */}
 {!valuationData ? (
 <div className="text-center py-12">
 Loading valuation data...
 </div>
 ) : valuationData.items.length === 0 ? (
 <div className="text-center py-12">
 No ingredients with stock found.
 </div>
 ) : (
 <div className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <table className="w-full min-w-[600px]">
 <thead className="border-b" style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <tr>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide">
 Ingredient
 </th>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide">
 Category
 </th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide">
 Stock
 </th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide">
 Avg Unit Cost
 </th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide">
 Total Value
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-stone-100">
 {valuationData.items.map((row: ValuationItem) => (
 <tr
 key={row.ingredientName}
 className="hover: transition-colors"
 >
 <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--fg)' }}>
 {row.ingredientName}
 </td>
 <td className="px-5 py-3.5">
 {row.category}
 </td>
 <td className="px-5 py-3.5 text-right">
 {row.stock} {row.unit}
 </td>
 <td className="px-5 py-3.5 text-right">
 {formatCurrency(row.avgUnitCost)}
 </td>
 <td className="px-5 py-3.5 text-right font-medium" style={{ color: 'var(--fg)' }}>
 {formatCurrency(row.totalValue)}
 </td>
 </tr>
 ))}
 {/* Totals row */}
 <tr className="font-semibold" style={{ backgroundColor: 'var(--muted)' }}>
 <td className="px-5 py-3.5" colSpan={4}>
 Total
 </td>
 <td className="px-5 py-3.5 text-right">
 {formatCurrency(valuationData.grandTotal)}
 </td>
 </tr>
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
}
