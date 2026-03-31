"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { exportToCSV } from "@/lib/export";
import { formatCurrency } from "@/lib/currency";

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
    token ? { token } : "skip"
  ) as LocationOption[] | undefined;

  const availableLocations = useMemo(() => {
    if (!locations || !session) return [];
    if (session.role === "owner") return locations;
    return locations.filter((loc: LocationOption) =>
      session.locationIds.includes(loc._id)
    );
  }, [locations, session]);

  const valuationData = useQuery(
    api.reports.queries.inventoryValuation,
    token ? { token, locationId } : "skip"
  ) as ValuationResult | undefined;

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg md:text-xl font-bold text-stone-900">
          Inventory Valuation
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Current stock value based on average purchase costs
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
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
            className="px-3 py-2 border border-stone-200 text-stone-600 text-sm rounded-xl hover:bg-stone-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Grand total card */}
      {valuationData && (
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-5 mb-6">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
            Total Inventory Value
          </p>
          <p className="text-2xl font-bold text-stone-900">
            {formatCurrency(valuationData.grandTotal)}
          </p>
          <p className="text-sm text-stone-500 mt-1">
            {valuationData.items.length} ingredient{valuationData.items.length !== 1 ? "s" : ""} in stock
          </p>
        </div>
      )}

      {/* Table */}
      {!valuationData ? (
        <div className="text-center text-stone-400 py-12">
          Loading valuation data...
        </div>
      ) : valuationData.items.length === 0 ? (
        <div className="text-center text-stone-400 py-12">
          No ingredients with stock found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-stone-50/50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Ingredient
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Category
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Stock
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Avg Unit Cost
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Total Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {valuationData.items.map((row: ValuationItem) => (
                <tr
                  key={row.ingredientName}
                  className="hover:bg-stone-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-stone-900">
                    {row.ingredientName}
                  </td>
                  <td className="px-5 py-3.5 text-stone-600">
                    {row.category}
                  </td>
                  <td className="px-5 py-3.5 text-right text-stone-600">
                    {row.stock} {row.unit}
                  </td>
                  <td className="px-5 py-3.5 text-right text-stone-600">
                    {formatCurrency(row.avgUnitCost)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-stone-900">
                    {formatCurrency(row.totalValue)}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-stone-50 font-semibold">
                <td className="px-5 py-3.5 text-stone-900" colSpan={4}>
                  Total
                </td>
                <td className="px-5 py-3.5 text-right text-stone-900">
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
