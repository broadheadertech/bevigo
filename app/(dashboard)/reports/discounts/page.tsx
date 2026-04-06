"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type LocationOption = {
  _id: Id<"locations">;
  name: string;
  slug: string;
  status: string;
};

type ByReasonRow = {
  reason: string;
  count: number;
  totalAmount: number;
};

type DiscountReportResult = {
  totalDiscounted: number;
  discountCount: number;
  avgDiscountPercent: number;
  byReason: ByReasonRow[];
};

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

function sevenDaysAgo(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7);
}

function todayEnd(): number {
  const now = new Date();
  return (
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
    24 * 60 * 60 * 1000 -
    1
  );
}

export default function DiscountReportPage() {
  const { session, token } = useAuth();

  const defaultStart = useMemo(() => sevenDaysAgo(), []);
  const defaultEnd = useMemo(() => todayEnd(), []);

  const [startDateStr, setStartDateStr] = useState(timestampToDateStr(defaultStart));
  const [endDateStr, setEndDateStr] = useState(timestampToDateStr(defaultEnd));
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const startDate = useMemo(() => dateToTimestamp(startDateStr), [startDateStr]);
  const endDate = useMemo(() => dateToTimestamp(endDateStr) + 24 * 60 * 60 * 1000 - 1, [endDateStr]);

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as LocationOption[] | undefined;

  const locationIdArg = selectedLocationId
    ? (selectedLocationId as Id<"locations">)
    : undefined;

  const report = useQuery(
    api.reports.queries.discountReport,
    token
      ? { token, startDate, endDate, locationId: locationIdArg }
      : "skip"
  ) as DiscountReportResult | undefined;

  if (!session || !token) {
    return (
      <div className="flex h-full items-center justify-center">
        <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Discount Report</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-fg)' }}>
          Overview of discounts applied to orders
        </p>
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl p-4 flex flex-wrap gap-4 items-end"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted-fg)' }}>
            Start Date
          </label>
          <input
            type="date"
            value={startDateStr}
            onChange={(e) => setStartDateStr(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted-fg)' }}>
            End Date
          </label>
          <input
            type="date"
            value={endDateStr}
            onChange={(e) => setEndDateStr(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
          />
        </div>
        {locations && locations.length > 1 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted-fg)' }}>
              Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm appearance-none"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
            >
              <option value="">All Locations</option>
              {locations.map((loc: LocationOption) => (
                <option key={loc._id} value={loc._id}>{loc.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            className="rounded-2xl p-5 shadow-lg"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>
              Total Discounted
            </p>
            <p className="text-2xl font-bold mt-1 text-red-400">
              {formatCurrency(report.totalDiscounted)}
            </p>
          </div>
          <div
            className="rounded-2xl p-5 shadow-lg"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>
              Discount Count
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--fg)' }}>
              {report.discountCount}
            </p>
          </div>
          <div
            className="rounded-2xl p-5 shadow-lg"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>
              Avg Discount %
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--fg)' }}>
              {report.avgDiscountPercent}%
            </p>
          </div>
        </div>
      )}

      {/* Breakdown by reason */}
      {report && report.byReason.length > 0 && (
        <div
          className="rounded-2xl shadow-lg overflow-hidden"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>By Reason</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--muted-fg)' }}>Reason</th>
                  <th className="text-right px-5 py-3 font-semibold" style={{ color: 'var(--muted-fg)' }}>Count</th>
                  <th className="text-right px-5 py-3 font-semibold" style={{ color: 'var(--muted-fg)' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.byReason.map((row: ByReasonRow) => (
                  <tr key={row.reason} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-5 py-3" style={{ color: 'var(--fg)' }}>{row.reason}</td>
                    <td className="px-5 py-3 text-right" style={{ color: 'var(--fg)' }}>{row.count}</td>
                    <td className="px-5 py-3 text-right text-red-400 font-medium">{formatCurrency(row.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {report && report.discountCount === 0 && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
        >
          <p style={{ color: 'var(--muted-fg)' }}>No discounts found for the selected period.</p>
        </div>
      )}

      {/* Loading */}
      {!report && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
        >
          <p style={{ color: 'var(--muted-fg)' }}>Loading report...</p>
        </div>
      )}
    </div>
  );
}
