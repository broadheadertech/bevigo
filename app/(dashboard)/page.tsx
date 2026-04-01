"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { Id } from "../../convex/_generated/dataModel";
import Link from "next/link";

type LocationOption = {
  _id: Id<"locations">;
  name: string;
  slug: string;
  status: string;
};

type DashboardMetrics = {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  taxCollected: number;
  pendingOrders: number;
  lowStockCount: number;
};

export default function DashboardPage() {
  const { session, token } = useAuth();

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const locationId = selectedLocationId
    ? (selectedLocationId as Id<"locations">)
    : undefined;

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as LocationOption[] | undefined;

  const metrics = useQuery(
    api.reports.dashboardQueries.getDashboardMetrics,
    token && session && (session.role === "owner" || session.role === "manager")
      ? { token, locationId }
      : "skip"
  ) as DashboardMetrics | undefined;

  // Filter locations for managers
  const availableLocations = useMemo(() => {
    if (!locations || !session) return [];
    if (session.role === "owner") return locations;
    return locations.filter((loc: LocationOption) =>
      session.locationIds.includes(loc._id)
    );
  }, [locations, session]);

  const isOwnerOrManager =
    session?.role === "owner" || session?.role === "manager";

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
      </div>
    );
  }

  // Baristas get a simple welcome
  if (!isOwnerOrManager) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>
            {greeting}{session.userName ? `, ${session.userName}` : ""}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
            Welcome to <span className="italic">bevi&amp;go</span> POS
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/order"
            className="px-5 py-3 text-sm font-semibold rounded-2xl hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 shadow-lg"
            style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
          >
            Open Register
          </Link>
        </div>
      </div>
    );
  }

  const metricCards: Array<{ label: string; value: string; accent?: boolean }> = [
    {
      label: "Total Revenue",
      value: metrics ? formatCurrency(metrics.totalRevenue) : "--",
      accent: true,
    },
    {
      label: "Orders Today",
      value: metrics ? String(metrics.orderCount) : "--",
    },
    {
      label: "Average Order",
      value: metrics ? formatCurrency(metrics.averageOrderValue) : "--",
    },
    {
      label: "Pending Orders",
      value: metrics ? String(metrics.pendingOrders) : "--",
    },
  ];

  return (
    <div>
      {/* Greeting + Location Selector */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>
            {greeting}{session.userName ? `, ${session.userName}` : ""}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
            Welcome to <span className="italic">bevi&amp;go</span> POS
          </p>
        </div>
        {availableLocations.length > 1 && (
          <select
            value={selectedLocationId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedLocationId(e.target.value)
            }
            className="rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
          >
            <option value="">All Locations</option>
            {availableLocations.map((loc: LocationOption) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Low Stock Alert */}
      {metrics && metrics.lowStockCount > 0 && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
          <svg
            className="w-5 h-5 text-amber-600 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-400">
              {metrics.lowStockCount} ingredient{metrics.lowStockCount !== 1 ? "s" : ""} below reorder threshold
            </p>
            <Link
              href="/inventory"
              className="text-sm text-amber-400 hover:text-amber-300 font-medium"
            >
              View Inventory
            </Link>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {metricCards.map((card: { label: string; value: string; accent?: boolean }) => (
          <div
            key={card.label}
            className="rounded-3xl shadow-lg p-8"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-fg)' }}>
              {card.label}
            </p>
            <p
              className="text-2xl font-bold"
              style={{ color: 'var(--fg)' }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-fg)' }}>
          Quick Actions
        </h2>
        <div className="flex gap-3">
          <Link
            href="/order"
            className="px-5 py-3.5 text-sm font-bold rounded-2xl hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 shadow-lg"
            style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
          >
            Open Register
          </Link>
          <Link
            href="/reports"
            className="px-5 py-3 text-sm font-medium rounded-2xl transition-colors"
            style={{ border: '1px solid var(--border-color)', color: 'var(--fg)' }}
          >
            View Reports
          </Link>
          <Link
            href="/menu"
            className="px-5 py-3 text-sm font-medium rounded-2xl transition-colors"
            style={{ border: '1px solid var(--border-color)', color: 'var(--fg)' }}
          >
            Manage Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
