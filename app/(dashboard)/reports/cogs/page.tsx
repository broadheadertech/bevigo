"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { exportToCSV } from "@/lib/export";
import { exportReportPDF } from "@/lib/export-pdf";
import { formatCurrency } from "@/lib/currency";

type LocationOption = {
  _id: Id<"locations">;
  name: string;
  slug: string;
  status: string;
};

type COGSItem = {
  itemName: string;
  qtySold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
};

function todayStart(): number {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).getTime();
}

function dateToTimestamp(dateStr: string): number {
  const parts = dateStr.split("-");
  return Date.UTC(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
}

function timestampToDateStr(ts: number): string {
  const d = new Date(ts);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function marginColor(margin: number): string {
  if (margin >= 60) return "text-green-600";
  if (margin >= 30) return "text-amber-600";
  return "text-red-600";
}

export default function COGSPage() {
  const { session, token } = useAuth();

  const defaultStart = useMemo(() => todayStart(), []);

  const [startDateStr, setStartDateStr] = useState(
    timestampToDateStr(defaultStart)
  );
  const [endDateStr, setEndDateStr] = useState(
    timestampToDateStr(defaultStart)
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const startDate = useMemo(
    () => dateToTimestamp(startDateStr),
    [startDateStr]
  );
  const endDate = useMemo(
    () => dateToTimestamp(endDateStr) + 24 * 60 * 60 * 1000 - 1,
    [endDateStr]
  );

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

  const cogsData = useQuery(
    api.reports.queries.costOfGoods,
    token ? { token, startDate, endDate, locationId } : "skip"
  ) as COGSItem[] | undefined;

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const totalRevenue = cogsData
    ? cogsData.reduce((sum: number, r: COGSItem) => sum + r.revenue, 0)
    : 0;
  const totalCogs = cogsData
    ? cogsData.reduce((sum: number, r: COGSItem) => sum + r.cogs, 0)
    : 0;
  const totalGrossProfit = totalRevenue - totalCogs;
  const overallMargin =
    totalRevenue > 0
      ? Math.round((totalGrossProfit / totalRevenue) * 1000) / 10
      : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg md:text-xl font-bold text-stone-900">
          Cost of Goods Sold
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Analyze ingredient costs, margins, and profitability per menu item
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
          </div>
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
              if (!cogsData) return;
              exportToCSV(
                cogsData.map((r: COGSItem) => ({
                  Item: r.itemName,
                  "Qty Sold": r.qtySold,
                  Revenue: r.revenue,
                  COGS: r.cogs,
                  "Gross Profit": r.grossProfit,
                  "Margin %": r.margin,
                })),
                "cogs-report.csv"
              );
            }}
            className="px-3 py-2 border border-stone-200 text-stone-600 text-sm rounded-xl hover:bg-stone-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              if (!cogsData) return;
              exportReportPDF(
                "Cost of Goods Sold",
                cogsData.map((r: COGSItem) => ({
                  Item: r.itemName,
                  "Qty Sold": String(r.qtySold),
                  Revenue: formatCurrency(r.revenue),
                  COGS: formatCurrency(r.cogs),
                  "Gross Profit": formatCurrency(r.grossProfit),
                  "Margin %": `${r.margin}%`,
                })),
                [
                  { key: "Item", label: "Item" },
                  { key: "Qty Sold", label: "Qty Sold" },
                  { key: "Revenue", label: "Revenue" },
                  { key: "COGS", label: "COGS" },
                  { key: "Gross Profit", label: "Gross Profit" },
                  { key: "Margin %", label: "Margin %" },
                ],
                {
                  "Total Revenue": formatCurrency(totalRevenue),
                  "Total COGS": formatCurrency(totalCogs),
                  "Gross Profit": formatCurrency(totalGrossProfit),
                  "Overall Margin": `${overallMargin}%`,
                }
              );
            }}
            className="px-3 py-2 border border-stone-200 text-stone-600 text-sm rounded-xl hover:bg-stone-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {cogsData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
              Total Revenue
            </p>
            <p className="text-xl font-bold text-stone-900">
              {formatCurrency(totalRevenue)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
              Total COGS
            </p>
            <p className="text-xl font-bold text-stone-900">
              {formatCurrency(totalCogs)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
              Gross Profit
            </p>
            <p className="text-xl font-bold text-stone-900">
              {formatCurrency(totalGrossProfit)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
              Overall Margin
            </p>
            <p className={`text-xl font-bold ${marginColor(overallMargin)}`}>
              {overallMargin}%
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {!cogsData ? (
        <div className="text-center text-stone-400 py-12">
          Loading COGS data...
        </div>
      ) : cogsData.length === 0 ? (
        <div className="text-center text-stone-400 py-12">
          No sales data for this period.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-stone-50/50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Item
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Qty Sold
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Revenue
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  COGS
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Gross Profit
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Margin %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cogsData.map((row: COGSItem) => (
                <tr
                  key={row.itemName}
                  className="hover:bg-stone-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-stone-900">
                    {row.itemName}
                  </td>
                  <td className="px-5 py-3.5 text-right text-stone-600">
                    {row.qtySold}
                  </td>
                  <td className="px-5 py-3.5 text-right text-stone-600">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-stone-600">
                    {formatCurrency(row.cogs)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-stone-600">
                    {formatCurrency(row.grossProfit)}
                  </td>
                  <td
                    className={`px-5 py-3.5 text-right font-semibold ${marginColor(row.margin)}`}
                  >
                    {row.margin}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
