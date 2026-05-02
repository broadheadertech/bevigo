"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { Id } from "../../convex/_generated/dataModel";
import Link from "next/link";
import { usePagination } from "@/components/ui/pagination";

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
            <TopSellers items={digest.products.topSellers} />
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
              <LowStockList rows={digest.lowStock} />
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
          <p className="text-[11px] mb-3" style={{ color: "var(--muted-fg)" }}>
            Mention these to your manager — they&apos;re below the reorder threshold.
          </p>
          <LowStockList rows={digest.lowStock.map((r) => ({ ...r, ingredientId: r.name, locationName: "" }))} />
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

/**
 * Top sellers list with rank chips and a relative-revenue progress bar.
 * Bar width is normalised to the #1 item so the eye picks up which one
 * is actually carrying the day.
 */
function TopSellers({
  items,
}: {
  items: Array<{ name: string; qty: number; revenue: number }>;
}) {
  const max = Math.max(...items.map((i) => i.revenue), 1);
  // Paginate 5 per page so the dashboard panel stays compact even when
  // every menu item sold today. Rank chip uses the absolute index so #6
  // on page 2 is still labelled "6".
  const { paginatedItems, currentPage, totalPages, setCurrentPage } =
    usePagination(items, 5);
  const offset = (currentPage - 1) * 5;
  return (
    <>
      <ol className="space-y-2">
        {paginatedItems.map((p, idx) => {
          const absoluteIdx = offset + idx;
          const widthPct = Math.max(6, (p.revenue / max) * 100);
          const isTop = absoluteIdx === 0;
          return (
            <li
              key={p.name}
              className="rounded-2xl px-3 py-2.5"
              style={{
                backgroundColor: "var(--muted)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    backgroundColor: isTop ? "var(--accent-color)" : "var(--card)",
                    color: isTop ? "white" : "var(--fg)",
                    border: isTop ? "none" : "1px solid var(--border-color)",
                  }}
                >
                  {absoluteIdx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "var(--fg)" }}>
                    {p.name}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
                    {p.qty} sold
                  </div>
                </div>
                <div className="font-bold text-sm shrink-0" style={{ color: "var(--fg)" }}>
                  {formatCurrency(p.revenue)}
                </div>
              </div>
              {/* Bottom progress strip — share-of-#1 revenue. Same shape
                  as the LowStockList so the two panels feel consistent. */}
              <div
                className="h-1 rounded-full mt-2 overflow-hidden"
                style={{ backgroundColor: "var(--card)" }}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: "var(--accent-color)",
                    opacity: isTop ? 1 : 0.5,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <CompactPager
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </>
  );
}

/**
 * Low-stock list — out-of-stock items get a red OUT chip; below-threshold
 * items show a tiny progress bar of on-hand vs threshold (clamped 0–100%
 * so an over-consumed negative value doesn't render as confusing -ml).
 * Sorted internally so OUT comes before LOW.
 */
function LowStockList({
  rows,
}: {
  rows: Array<{
    ingredientId: string;
    name: string;
    unit: string;
    onHand: number;
    reorderThreshold: number;
    isOut: boolean;
    locationName?: string;
  }>;
}) {
  const sorted = [...rows].sort((a, b) => {
    if (a.isOut !== b.isOut) return a.isOut ? -1 : 1;
    return a.onHand - b.onHand;
  });
  // Paginate 5 per page so the panel matches the Top Sellers list height
  // and the operator can step through every flagged item without an
  // ever-growing card.
  const { paginatedItems, currentPage, totalPages, setCurrentPage } =
    usePagination(sorted, 5);
  return (
    <>
    <ul className="space-y-2">
      {paginatedItems.map((r) => {
        // Clamp to >=0 for display so a negative on-hand doesn't read like
        // "-13350.0ml". The reality is "out" — show 0 + the OUT chip.
        const displayQty = Math.max(0, r.onHand);
        const pct = r.reorderThreshold > 0
          ? Math.min(100, Math.max(0, (displayQty / r.reorderThreshold) * 100))
          : 0;
        const accent = r.isOut ? "#ef4444" : "#f59e0b";
        return (
          <li
            key={r.ingredientId + (r.locationName ?? "")}
            className="rounded-2xl px-3 py-2.5"
            style={{
              backgroundColor: "var(--muted)",
              border: "1px solid var(--border-color)",
              borderLeft: `4px solid ${accent}`,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate" style={{ color: "var(--fg)" }}>
                    {r.name}
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: accent,
                      color: "white",
                    }}
                  >
                    {r.isOut ? "Out" : "Low"}
                  </span>
                </div>
                {r.locationName && (
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-fg)" }}>
                    {r.locationName}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-sm" style={{ color: accent }}>
                  {displayQty.toFixed(1)}
                  <span className="ml-0.5 text-[11px] font-normal" style={{ color: "var(--muted-fg)" }}>
                    {r.unit}
                  </span>
                </div>
                <div className="text-[10px]" style={{ color: "var(--muted-fg)" }}>
                  reorder at {r.reorderThreshold}{r.unit}
                </div>
              </div>
            </div>
            {/* Progress bar: how close on-hand is to threshold. */}
            <div
              className="h-1.5 rounded-full mt-2 overflow-hidden"
              style={{ backgroundColor: "var(--card)" }}
            >
              <div
                className="h-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: accent }}
              />
            </div>
          </li>
        );
      })}
    </ul>
    <CompactPager
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
    </>
  );
}

/**
 * Lightweight pager for the dashboard panels — single line with prev/next
 * chevrons and a page counter. Avoids the full table-style "Previous /
 * 1 / 2 / ... / 7 / Next" footer which dominates a small card.
 */
function CompactPager({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div
      className="flex items-center justify-between mt-3 pt-3"
      style={{ borderTop: "1px solid var(--border-color)" }}
    >
      <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
        Page {currentPage} / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--fg)",
            border: "1px solid var(--border-color)",
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--fg)",
            border: "1px solid var(--border-color)",
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
