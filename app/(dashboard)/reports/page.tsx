"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { exportToCSV } from "@/lib/export";
import { exportReportPDF } from "@/lib/export-pdf";
import { formatCurrency } from "@/lib/currency";

type Tab = "daily" | "product" | "hourly";

type LocationOption = {
  _id: Id<"locations">;
  name: string;
  slug: string;
  status: string;
};

type DailySummaryResult = {
  totalRevenue: number;
  transactionCount: number;
  averageOrderValue: number;
  taxCollected: number;
};

type ProductMixItem = {
  itemName: string;
  quantitySold: number;
  totalRevenue: number;
  percentageOfTotal: number;
};

type HourlyVolumeItem = {
  hour: number;
  transactionCount: number;
  revenue: number;
};

function todayStart(): number {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).getTime();
}

function todayEnd(): number {
  return todayStart() + 24 * 60 * 60 * 1000 - 1;
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

export default function ReportsPage() {
  const { session, token } = useAuth();

  const defaultStart = useMemo(() => todayStart(), []);
  const defaultEnd = useMemo(() => todayEnd(), []);

  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [startDateStr, setStartDateStr] = useState(
    timestampToDateStr(defaultStart)
  );
  const [endDateStr, setEndDateStr] = useState(
    timestampToDateStr(defaultEnd)
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

  // Filter locations for managers
  const availableLocations = useMemo(() => {
    if (!locations || !session) return [];
    if (session.role === "owner") return locations;
    return locations.filter((loc: LocationOption) =>
      session.locationIds.includes(loc._id)
    );
  }, [locations, session]);

  const dailySummary = useQuery(
    api.reports.queries.dailySummary,
    token && activeTab === "daily"
      ? { token, startDate, endDate, locationId }
      : "skip"
  ) as DailySummaryResult | undefined;

  const productMix = useQuery(
    api.reports.queries.productMix,
    token && activeTab === "product"
      ? { token, startDate, endDate, locationId }
      : "skip"
  ) as ProductMixItem[] | undefined;

  const hourlyVolume = useQuery(
    api.reports.queries.hourlyVolume,
    token && activeTab === "hourly"
      ? { token, date: dateToTimestamp(startDateStr), locationId }
      : "skip"
  ) as HourlyVolumeItem[] | undefined;

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "daily", label: "Daily Summary" },
    { key: "product", label: "Product Mix" },
    { key: "hourly", label: "Hourly Volume" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100">Sales Reports</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">Track revenue, products, and hourly trends</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <button
            onClick={() => {
              if (activeTab === "daily" && dailySummary) {
                exportToCSV([{
                  totalRevenue: dailySummary.totalRevenue,
                  transactionCount: dailySummary.transactionCount,
                  averageOrderValue: dailySummary.averageOrderValue,
                  taxCollected: dailySummary.taxCollected,
                }], "daily-summary.csv");
              } else if (activeTab === "product" && productMix) {
                exportToCSV(productMix.map((item: ProductMixItem) => ({
                  itemName: item.itemName,
                  quantitySold: item.quantitySold,
                  totalRevenue: item.totalRevenue,
                  percentageOfTotal: item.percentageOfTotal,
                })), "product-mix.csv");
              } else if (activeTab === "hourly" && hourlyVolume) {
                exportToCSV(hourlyVolume.map((h: HourlyVolumeItem) => ({
                  hour: formatHour(h.hour),
                  transactionCount: h.transactionCount,
                  revenue: h.revenue,
                })), "hourly-volume.csv");
              }
            }}
            className="px-3 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-sm rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              if (activeTab === "daily" && dailySummary) {
                exportReportPDF(
                  "Daily Summary",
                  [{
                    "Total Revenue": formatCurrency(dailySummary.totalRevenue),
                    "Transactions": String(dailySummary.transactionCount),
                    "Avg Order Value": formatCurrency(dailySummary.averageOrderValue),
                    "Tax Collected": formatCurrency(dailySummary.taxCollected),
                  }],
                  [
                    { key: "Total Revenue", label: "Total Revenue" },
                    { key: "Transactions", label: "Transactions" },
                    { key: "Avg Order Value", label: "Avg Order Value" },
                    { key: "Tax Collected", label: "Tax Collected" },
                  ],
                  {
                    "Total Revenue": formatCurrency(dailySummary.totalRevenue),
                    "Transactions": String(dailySummary.transactionCount),
                  }
                );
              } else if (activeTab === "product" && productMix) {
                exportReportPDF(
                  "Product Mix",
                  productMix.map((item: ProductMixItem) => ({
                    "Item Name": item.itemName,
                    "Qty Sold": String(item.quantitySold),
                    "Revenue": formatCurrency(item.totalRevenue),
                    "% of Total": `${item.percentageOfTotal.toFixed(1)}%`,
                  })),
                  [
                    { key: "Item Name", label: "Item Name" },
                    { key: "Qty Sold", label: "Qty Sold" },
                    { key: "Revenue", label: "Revenue" },
                    { key: "% of Total", label: "% of Total" },
                  ]
                );
              } else if (activeTab === "hourly" && hourlyVolume) {
                exportReportPDF(
                  "Hourly Volume",
                  hourlyVolume.map((h: HourlyVolumeItem) => ({
                    "Hour": formatHour(h.hour),
                    "Transactions": String(h.transactionCount),
                    "Revenue": formatCurrency(h.revenue),
                  })),
                  [
                    { key: "Hour", label: "Hour" },
                    { key: "Transactions", label: "Transactions" },
                    { key: "Revenue", label: "Revenue" },
                  ]
                );
              }
            }}
            className="px-3 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-sm rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            Export PDF
          </button>
        </div>
        <div className="flex flex-wrap gap-4 items-end mt-3">
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
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
              className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">
              Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            >
              <option value="">All Locations</option>
              {availableLocations.map((loc: LocationOption) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((tab: { key: Tab; label: string }) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
              activeTab === tab.key
                ? "bg-stone-900 text-white"
                : "bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "daily" && (
        <DailySummaryTab data={dailySummary} />
      )}
      {activeTab === "product" && (
        <ProductMixTab data={productMix} />
      )}
      {activeTab === "hourly" && (
        <HourlyVolumeTab data={hourlyVolume} />
      )}
    </div>
  );
}

function DailySummaryTab({ data }: { data: DailySummaryResult | undefined }) {
  if (!data) {
    return (
      <div className="text-center text-stone-400 py-12">
        Loading summary...
      </div>
    );
  }

  const cards: Array<{ label: string; value: string }> = [
    { label: "Total Revenue", value: formatCurrency(data.totalRevenue) },
    { label: "Transactions", value: String(data.transactionCount) },
    {
      label: "Avg Order Value",
      value: formatCurrency(data.averageOrderValue),
    },
    { label: "Tax Collected", value: formatCurrency(data.taxCollected) },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
      {cards.map((card: { label: string; value: string }) => (
        <div
          key={card.label}
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6"
        >
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
            {card.label}
          </p>
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function ProductMixTab({
  data,
}: {
  data: ProductMixItem[] | undefined;
}) {
  if (!data) {
    return (
      <div className="text-center text-stone-400 py-12">
        Loading product mix...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center text-stone-400 py-12">
        No sales data for this period.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full min-w-[500px]">
        <thead className="bg-stone-50/50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800">
          <tr>
            <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
              Item Name
            </th>
            <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
              Qty Sold
            </th>
            <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
              Revenue
            </th>
            <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
              % of Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {data.map((item: ProductMixItem) => (
            <tr
              key={item.itemName}
              className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors"
            >
              <td className="px-5 py-3.5 font-medium text-stone-900 dark:text-stone-100">{item.itemName}</td>
              <td className="px-5 py-3.5 text-right text-stone-600 dark:text-stone-400">
                {item.quantitySold}
              </td>
              <td className="px-5 py-3.5 text-right text-stone-600 dark:text-stone-400">
                {formatCurrency(item.totalRevenue)}
              </td>
              <td className="px-5 py-3.5 text-right text-stone-600 dark:text-stone-400">
                {item.percentageOfTotal.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HourlyVolumeTab({
  data,
}: {
  data: HourlyVolumeItem[] | undefined;
}) {
  if (!data) {
    return (
      <div className="text-center text-stone-400 py-12">
        Loading hourly data...
      </div>
    );
  }

  const maxCount = Math.max(
    ...data.map((h: HourlyVolumeItem) => h.transactionCount),
    1
  );
  const peakHour = data.reduce(
    (
      peak: HourlyVolumeItem,
      curr: HourlyVolumeItem
    ) => (curr.transactionCount > peak.transactionCount ? curr : peak),
    data[0]
  );

  const hasData = data.some(
    (h: HourlyVolumeItem) => h.transactionCount > 0
  );

  if (!hasData) {
    return (
      <div className="text-center text-stone-400 py-12">
        No sales data for this date.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6">
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Peak hour:{" "}
        <span className="font-semibold text-stone-900 dark:text-stone-100">
          {formatHour(peakHour.hour)}
        </span>{" "}
        ({peakHour.transactionCount} transactions,{" "}
        {formatCurrency(peakHour.revenue)})
      </p>
      <div className="flex items-end gap-1" style={{ height: "200px" }}>
        {data.map((h: HourlyVolumeItem) => {
          const heightPct =
            maxCount > 0 ? (h.transactionCount / maxCount) * 100 : 0;
          const isPeak = h.hour === peakHour.hour && h.transactionCount > 0;
          return (
            <div
              key={h.hour}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              <div
                className={`w-full rounded-t transition-all ${
                  isPeak ? "bg-amber-600" : "bg-amber-300"
                }`}
                style={{
                  height: `${heightPct}%`,
                  minHeight: h.transactionCount > 0 ? "4px" : "0px",
                }}
                title={`${formatHour(h.hour)}: ${h.transactionCount} txns, ${formatCurrency(h.revenue)}`}
              />
              <span className="text-xs text-stone-400 mt-1">
                {h.hour % 3 === 0 ? formatHourShort(h.hour) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function formatHourShort(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}
