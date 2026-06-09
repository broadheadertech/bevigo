"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type Me = {
  email: string;
  name: string;
  expiresAt: number;
  currentTenantId: Id<"tenants"> | null;
  currentTenantName: string | null;
};

type Overview = {
  _id: Id<"tenants">;
  name: string;
  slug: string;
  status: string;
  createdAt: number;
  orderCount30d: number;
  revenue30d: number;
  locationCount: number;
  activeStaffCount: number;
  lastActivityAt: number | null;
  lastLoginAt: number | null;
  birConfigured: boolean;
  hadShiftThisWeek: boolean;
  hadSalesLast7d: boolean;
  health: "ok" | "warning" | "stalled";
  healthReasons: string[];
};

type Snapshot = {
  generatedAt: number;
  activeTenants: number;
  suspendedTenants: number;
  totalTenants: number;
  ordersToday: number;
  revenue30d: number;
  topTenants: Array<{ _id: Id<"tenants">; name: string; revenue: number }>;
};

type Activity = {
  ts: number;
  kind: "order" | "shift_start" | "shift_end" | "tenant_created";
  tenantId: Id<"tenants">;
  tenantName: string;
  label: string;
  amount?: number;
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? m[2] : null;
}

function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function relativeTime(ts: number | null): string {
  if (ts === null) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  if (diff < 7 * 24 * 60 * 60_000)
    return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function TenantsPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(getCookie("session_token")), []);

  const me = useQuery(api.platform.session.me, token ? { token } : "skip") as
    | Me
    | null
    | undefined;
  const snapshot = useQuery(
    api.platform.admin.platformSnapshot,
    token ? { token } : "skip"
  ) as Snapshot | undefined;
  const overview = useQuery(
    api.platform.admin.listTenantOverview,
    token ? { token } : "skip"
  ) as Overview[] | undefined;
  const activity = useQuery(
    api.platform.admin.recentActivity,
    token ? { token, limit: 20 } : "skip"
  ) as Activity[] | undefined;

  const switchTenant = useMutation(api.platform.session.switchTenant);
  const exitTenant = useMutation(api.platform.session.exitTenant);
  const logout = useMutation(api.platform.session.logout);
  const setStatus = useMutation(api.platform.admin.setTenantStatus);

  useEffect(() => {
    if (token === null) return;
    if (me === null) window.location.replace("/platform/login");
  }, [token, me]);

  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<"all" | "stalled" | "warning" | "ok">("all");
  const [busyTenant, setBusyTenant] = useState<Id<"tenants"> | null>(null);

  const filtered = useMemo(() => {
    if (!overview) return [];
    const q = search.trim().toLowerCase();
    return overview.filter((t) => {
      if (healthFilter !== "all" && t.health !== healthFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
      );
    });
  }, [overview, search, healthFilter]);

  const handlePick = async (tenantId: Id<"tenants">) => {
    if (!token) return;
    await switchTenant({ token, tenantId });
    window.location.href = "/";
  };

  const handleToggleStatus = async (
    tenantId: Id<"tenants">,
    current: string
  ) => {
    if (!token) return;
    const next = current === "active" ? "suspended" : "active";
    const verb = next === "active" ? "Resume" : "Suspend";
    const reason =
      next === "suspended"
        ? prompt(`${verb} this tenant — reason?`) ?? undefined
        : undefined;
    if (next === "suspended" && reason === undefined) return;
    setBusyTenant(tenantId);
    try {
      await setStatus({ token, tenantId, status: next, reason });
    } finally {
      setBusyTenant(null);
    }
  };

  const handleSignOut = async () => {
    if (token) await logout({ token });
    document.cookie =
      "session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    window.location.href = "/platform/login";
  };

  const handleExit = async () => {
    if (!token) return;
    await exitTenant({ token });
  };

  if (!token || me === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg)", color: "var(--muted-fg)" }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6 md:p-10"
      style={{ backgroundColor: "var(--bg)", color: "var(--fg)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: "var(--muted-fg)" }}
            >
              Platform Console
            </p>
            <h1 className="text-2xl font-bold mt-1">SaaS Admin</h1>
            {me && (
              <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
                Signed in as <strong>{me.name}</strong> · session expires{" "}
                {new Date(me.expiresAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <a
              href="/platform/tenants/new"
              className="px-4 py-2 rounded-2xl text-sm font-semibold"
              style={{
                backgroundColor: "var(--accent-color)",
                color: "white",
              }}
            >
              + New tenant
            </a>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-2xl text-sm font-semibold"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Currently impersonating banner */}
        {me?.currentTenantId && me.currentTenantName && (
          <div
            className="rounded-3xl p-4 mb-6 flex items-center justify-between"
            style={{
              backgroundColor: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            <div className="text-sm">
              Currently impersonating <strong>{me.currentTenantName}</strong>.{" "}
              <a
                href="/"
                className="underline"
                style={{ color: "var(--accent-color)" }}
              >
                Open dashboard →
              </a>
            </div>
            <button
              onClick={handleExit}
              className="text-xs font-semibold underline"
              style={{ color: "var(--muted-fg)" }}
            >
              Stop impersonating
            </button>
          </div>
        )}

        {/* Snapshot KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi
            label="Active tenants"
            value={
              snapshot ? `${snapshot.activeTenants} / ${snapshot.totalTenants}` : "…"
            }
            sub={
              snapshot && snapshot.suspendedTenants > 0
                ? `${snapshot.suspendedTenants} suspended`
                : undefined
            }
          />
          <Kpi
            label="Orders today"
            value={snapshot ? String(snapshot.ordersToday) : "…"}
          />
          <Kpi
            label="Revenue last 30d"
            value={snapshot ? formatCurrency(snapshot.revenue30d) : "…"}
            accent
          />
          <Kpi
            label="Top tenant 30d"
            value={
              snapshot && snapshot.topTenants[0]
                ? snapshot.topTenants[0].name
                : "—"
            }
            sub={
              snapshot && snapshot.topTenants[0]
                ? formatCurrency(snapshot.topTenants[0].revenue)
                : undefined
            }
          />
        </div>

        {/* Activity feed */}
        <Section title="Recent activity">
          {activity === undefined ? (
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              Loading…
            </p>
          ) : activity.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              Nothing in the last 7 days.
            </p>
          ) : (
            <ul className="space-y-1">
              {activity.slice(0, 10).map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span style={{ color: "var(--fg)" }}>
                    <span
                      className="text-[10px] uppercase tracking-widest mr-2 inline-block px-1.5 py-0.5 rounded-full font-bold"
                      style={{
                        backgroundColor:
                          a.kind === "order"
                            ? "rgba(16,185,129,0.15)"
                            : a.kind === "tenant_created"
                              ? "rgba(245,158,11,0.15)"
                              : "var(--muted)",
                        color:
                          a.kind === "order"
                            ? "#059669"
                            : a.kind === "tenant_created"
                              ? "#d97706"
                              : "var(--muted-fg)",
                      }}
                    >
                      {a.kind === "order"
                        ? "Sale"
                        : a.kind === "shift_start"
                          ? "Shift Open"
                          : a.kind === "shift_end"
                            ? "Shift Close"
                            : "New Tenant"}
                    </span>
                    <strong>{a.tenantName}</strong>
                    <span className="ml-1" style={{ color: "var(--muted-fg)" }}>
                      · {a.label}
                    </span>
                    {a.amount !== undefined && (
                      <span
                        className="ml-2 font-mono"
                        style={{ color: "var(--accent-color)" }}
                      >
                        {formatCurrency(a.amount)}
                      </span>
                    )}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {relativeTime(a.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3 mt-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tenants…"
            className="flex-1 min-w-50 rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          />
          <div
            className="inline-flex rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border-color)" }}
          >
            {(["all", "stalled", "warning", "ok"] as const).map((s) => {
              const active = healthFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setHealthFilter(s)}
                  className="px-3 py-2 text-xs font-semibold"
                  style={{
                    backgroundColor: active
                      ? "var(--accent-color)"
                      : "transparent",
                    color: active ? "white" : "var(--fg)",
                  }}
                >
                  {s === "all"
                    ? "All"
                    : s === "stalled"
                      ? "Stalled"
                      : s === "warning"
                        ? "Warning"
                        : "OK"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tenant table */}
        <div
          className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          {overview === undefined ? (
            <p
              className="p-8 text-center text-sm"
              style={{ color: "var(--muted-fg)" }}
            >
              Loading tenants…
            </p>
          ) : filtered.length === 0 ? (
            <p
              className="p-8 text-center text-sm"
              style={{ color: "var(--muted-fg)" }}
            >
              {search.trim() || healthFilter !== "all"
                ? "No tenants match this filter."
                : "No tenants exist yet."}
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--muted)",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  <Th>Tenant</Th>
                  <Th>Health</Th>
                  <Th align="right">Orders 30d</Th>
                  <Th align="right">Revenue 30d</Th>
                  <Th align="right">Locations</Th>
                  <Th align="right">Staff</Th>
                  <Th>Last login</Th>
                  <Th>Last activity</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const sevColor =
                    t.health === "stalled"
                      ? "#ef4444"
                      : t.health === "warning"
                        ? "#f59e0b"
                        : "#10b981";
                  return (
                    <tr
                      key={t._id}
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-semibold" style={{ color: "var(--fg)" }}>
                          {t.name}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--muted-fg)" }}>
                          {t.slug}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                          style={{ backgroundColor: sevColor, color: "white" }}
                          title={t.healthReasons.join(" · ")}
                        >
                          {t.health}
                        </span>
                        {t.healthReasons.length > 0 && (
                          <div
                            className="text-[10px] mt-1 max-w-50"
                            style={{ color: "var(--muted-fg)" }}
                            title={t.healthReasons.join(" · ")}
                          >
                            {t.healthReasons.slice(0, 2).join(", ")}
                            {t.healthReasons.length > 2
                              ? ` +${t.healthReasons.length - 2}`
                              : ""}
                          </div>
                        )}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-mono"
                        style={{ color: "var(--fg)" }}
                      >
                        {t.orderCount30d}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-mono font-semibold"
                        style={{ color: "var(--fg)" }}
                      >
                        {formatCurrency(t.revenue30d)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-mono"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        {t.locationCount}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-mono"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        {t.activeStaffCount}
                      </td>
                      <td
                        className="px-3 py-2.5 text-[11px]"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        {relativeTime(t.lastLoginAt)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-[11px]"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        {relativeTime(t.lastActivityAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => handlePick(t._id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                            style={{
                              backgroundColor: "var(--accent-color)",
                              color: "white",
                            }}
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleToggleStatus(t._id, t.status)}
                            disabled={busyTenant === t._id}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-50"
                            style={{
                              backgroundColor: "var(--muted)",
                              color: t.status === "active" ? "#ef4444" : "#10b981",
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            {t.status === "active" ? "Suspend" : "Resume"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
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
        backgroundColor: accent ? "var(--accent-color)" : "var(--card)",
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
      <p className="text-lg font-bold truncate">{value}</p>
      {sub && (
        <p
          className="text-[10px] mt-0.5"
          style={{ color: accent ? "rgba(255,255,255,0.7)" : "var(--muted-fg)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <h2
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: "var(--muted-fg)" }}
      >
        {title}
      </h2>
      <div
        className="rounded-2xl p-4"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: "var(--muted-fg)" }}
    >
      {children}
    </th>
  );
}
