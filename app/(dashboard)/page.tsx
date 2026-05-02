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

type AdminDigest = {
  generatedAt: number;
  windowStart: number;
  sales: {
    revenue: number;
    orderCount: number;
    avgTicket: number;
    refundCount: number;
    voidCount: number;
  };
  products: {
    topSellers: Array<{ name: string; qty: number; revenue: number }>;
  };
  operations: {
    peakHour: number;
    peakHourOrders: number;
    parkedCount: number;
    openShiftCount: number;
  };
  lowStock: Array<{
    ingredientId: string;
    name: string;
    unit: string;
    onHand: number;
    reorderThreshold: number;
    isOut: boolean;
    locationName: string;
  }>;
  lowStockCount: number;
  outOfStockCount: number;
  reminders: Array<{
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
    href?: string;
  }>;
};

type BaristaDigest = {
  generatedAt: number;
  myOrderCount: number;
  myItemsSold: number;
  myParkedCount: number;
  myActiveShiftId: Id<"shifts"> | null;
  myActiveShiftStart: number | null;
  lowStock: Array<{
    name: string;
    unit: string;
    onHand: number;
    reorderThreshold: number;
    isOut: boolean;
  }>;
  lowStockCount: number;
  outOfStockCount: number;
  reminders: Array<{
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
    href?: string;
  }>;
};

function fmtHour(h: number) {
  return `${h}:00–${h + 1}:00`;
}

function severityColor(s: "high" | "medium" | "low") {
  return s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#10b981";
}
function severityLabel(s: "high" | "medium" | "low") {
  return s === "high" ? "Now" : s === "medium" ? "Soon" : "FYI";
}

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
    token && session && (session.role === "owner" || session.role === "manager")
      ? { token }
      : "skip"
  ) as LocationOption[] | undefined;

  const adminDigest = useQuery(
    api.reports.dashboardDigest.getDashboardDigest,
    token && session && (session.role === "owner" || session.role === "manager")
      ? { token, locationId }
      : "skip"
  ) as AdminDigest | undefined;

  const baristaDigest = useQuery(
    api.reports.dashboardDigest.getBaristaDigest,
    token && session?.role === "barista" ? { token } : "skip"
  ) as BaristaDigest | undefined;

  const availableLocations = useMemo(() => {
    if (!locations || !session) return [];
    if (session.role === "owner") return locations;
    return locations.filter((loc) => session.locationIds.includes(loc._id));
  }, [locations, session]);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading…</p>
      </div>
    );
  }

  const isOwnerOrManager =
    session.role === "owner" || session.role === "manager";

  return (
    <div>
      {/* Greeting + (admin) location selector */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
            {greeting}
            {session.userName ? `, ${session.userName}` : ""}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Here&apos;s what needs your attention today.
          </p>
        </div>
        {isOwnerOrManager && availableLocations.length > 1 && (
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          >
            <option value="">All Locations</option>
            {availableLocations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isOwnerOrManager ? (
        <AdminDashboard digest={adminDigest} />
      ) : (
        <BaristaDashboard digest={baristaDigest} />
      )}

      {/* Quick Actions — same for everyone */}
      <div className="mt-8">
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--muted-fg)" }}
        >
          Quick actions
        </h2>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/order"
            className="px-5 py-3.5 text-sm font-bold rounded-2xl shadow-lg active:scale-95 transition-all"
            style={{ backgroundColor: "var(--accent-color)", color: "white" }}
          >
            Open Register
          </Link>
          {isOwnerOrManager && (
            <>
              <Link
                href="/reports"
                className="px-5 py-3 text-sm font-medium rounded-2xl"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Reports
              </Link>
              <Link
                href="/inventory"
                className="px-5 py-3 text-sm font-medium rounded-2xl"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Inventory
              </Link>
              <Link
                href="/menu"
                className="px-5 py-3 text-sm font-medium rounded-2xl"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Menu
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ digest }: { digest: AdminDigest | undefined }) {
  if (!digest) {
    return (
      <div
        className="rounded-3xl p-12 text-center text-sm"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
          color: "var(--muted-fg)",
        }}
      >
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reminders */}
      {digest.reminders.length > 0 && (
        <Section title="Reminders">
          <div className="space-y-2">
            {digest.reminders.map((r, i) => (
              <ReminderCard key={i} {...r} />
            ))}
          </div>
        </Section>
      )}

      {/* Today's snapshot */}
      <Section title="Today's snapshot">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Revenue" value={formatCurrency(digest.sales.revenue)} accent />
          <KpiCard
            label="Orders"
            value={String(digest.sales.orderCount)}
            sub={`${digest.operations.openShiftCount} open shift${digest.operations.openShiftCount === 1 ? "" : "s"}`}
          />
          <KpiCard label="Avg ticket" value={formatCurrency(digest.sales.avgTicket)} />
          <KpiCard
            label="Peak hour"
            value={fmtHour(digest.operations.peakHour)}
            sub={`${digest.operations.peakHourOrders} orders`}
          />
        </div>
      </Section>

      {/* Top sellers + Low stock side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section title={`Top sellers today (${digest.products.topSellers.length})`}>
          {digest.products.topSellers.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              No sales yet today.
            </p>
          ) : (
            <div className="space-y-2">
              {digest.products.topSellers.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--fg)" }}>
                    {p.name}{" "}
                    <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      × {p.qty}
                    </span>
                  </span>
                  <span className="font-semibold" style={{ color: "var(--fg)" }}>
                    {formatCurrency(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title={`Low stock (${digest.lowStockCount}${digest.outOfStockCount > 0 ? ` · ${digest.outOfStockCount} out` : ""})`}
        >
          {digest.lowStock.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              All ingredients above threshold.
            </p>
          ) : (
            <div className="space-y-2">
              {digest.lowStock.map((r) => (
                <div
                  key={r.ingredientId + r.locationName}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate" style={{ color: "var(--fg)" }}>
                      {r.name}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--muted-fg)" }}>
                      {r.locationName}
                    </div>
                  </div>
                  <span
                    className="font-mono font-semibold ml-3 text-right shrink-0"
                    style={{ color: r.isOut ? "#ef4444" : "#f59e0b" }}
                  >
                    {r.onHand.toFixed(1)}
                    {r.unit}
                    <span className="ml-1 text-[10px] font-normal" style={{ color: "var(--muted-fg)" }}>
                      / {r.reorderThreshold}
                      {r.unit}
                    </span>
                  </span>
                </div>
              ))}
              <Link
                href="/inventory"
                className="text-xs font-semibold inline-block mt-2 underline"
                style={{ color: "var(--accent-color)" }}
              >
                Open Inventory →
              </Link>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function BaristaDashboard({ digest }: { digest: BaristaDigest | undefined }) {
  if (!digest) {
    return (
      <div
        className="rounded-3xl p-12 text-center text-sm"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
          color: "var(--muted-fg)",
        }}
      >
        Loading…
      </div>
    );
  }

  const shiftStart = digest.myActiveShiftStart;
  return (
    <div className="space-y-6">
      {digest.reminders.length > 0 && (
        <Section title="Reminders">
          <div className="space-y-2">
            {digest.reminders.map((r, i) => (
              <ReminderCard key={i} {...r} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Your day so far">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="My orders today" value={String(digest.myOrderCount)} accent />
          <KpiCard label="Items rung up" value={String(digest.myItemsSold)} />
          <KpiCard label="My parked orders" value={String(digest.myParkedCount)} />
          <KpiCard
            label="Shift status"
            value={shiftStart ? "Active" : "Not started"}
            sub={
              shiftStart
                ? `Since ${new Date(shiftStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : "Open the register to start"
            }
          />
        </div>
      </Section>

      {digest.lowStock.length > 0 && (
        <Section
          title={`Stock to flag (${digest.lowStockCount}${digest.outOfStockCount > 0 ? ` · ${digest.outOfStockCount} out` : ""})`}
        >
          <p className="text-[11px] mb-2" style={{ color: "var(--muted-fg)" }}>
            Mention these to your manager — they&apos;re below the reorder threshold.
          </p>
          <div className="space-y-2">
            {digest.lowStock.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--fg)" }}>{r.name}</span>
                <span
                  className="font-mono font-semibold"
                  style={{ color: r.isOut ? "#ef4444" : "#f59e0b" }}
                >
                  {r.onHand.toFixed(1)}
                  {r.unit}
                  <span className="ml-1 text-[10px] font-normal" style={{ color: "var(--muted-fg)" }}>
                    / {r.reorderThreshold}
                    {r.unit}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--muted-fg)" }}
      >
        {title}
      </h2>
      <div
        className="rounded-3xl shadow-lg p-5"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {children}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: accent ? "var(--accent-color)" : "var(--muted)",
        color: accent ? "white" : "var(--fg)",
        border: accent ? "none" : "1px solid var(--border-color)",
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-1"
        style={{ color: accent ? "rgba(255,255,255,0.8)" : "var(--muted-fg)" }}
      >
        {label}
      </p>
      <p className="text-xl font-bold">{value}</p>
      {sub && (
        <p
          className="text-[10px] mt-1"
          style={{ color: accent ? "rgba(255,255,255,0.7)" : "var(--muted-fg)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function ReminderCard({
  severity,
  title,
  detail,
  href,
}: {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  href?: string;
}) {
  const sev = severityColor(severity);
  const lbl = severityLabel(severity);
  const inner = (
    <div
      className="rounded-2xl p-4 flex gap-4 items-start transition-all active:scale-[0.99]"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border-color)",
        borderLeft: `4px solid ${sev}`,
      }}
    >
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0"
        style={{ backgroundColor: sev, color: "white" }}
      >
        {lbl}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold" style={{ color: "var(--fg)" }}>
          {title}
        </div>
        <div className="text-sm mt-0.5 truncate" style={{ color: "var(--muted-fg)" }}>
          {detail}
        </div>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-95">
      {inner}
    </Link>
  ) : (
    inner
  );
}
