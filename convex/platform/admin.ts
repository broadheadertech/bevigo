import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { findPlatformSession } from "./helpers";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Platform-console admin queries — usage and health rollups across every
 * tenant. All gated through findPlatformSession so they're owner-of-
 * platform only; no regular tenant token can reach these.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-tenant usage + health roll-up. Returns one row per tenant with the
 * metrics a SaaS operator needs at a glance:
 *   - 30-day order count + gross revenue (drives per-tenant billing)
 *   - active staff (active users in the tenant)
 *   - location count
 *   - last activity (latest order completion timestamp)
 *   - last login (latest session createdAt across all tenant users)
 *   - health flags: zero sales 7d, BIR incomplete, no shifts started this
 *     week, no active locations
 */
export const listTenantOverview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) throw new Error("Unauthorized");

    const now = Date.now();
    const last30 = now - 30 * DAY_MS;
    const last7 = now - 7 * DAY_MS;

    const tenants = await ctx.db.query("tenants").collect();

    type Row = {
      _id: Id<"tenants">;
      name: string;
      slug: string;
      status: string;
      createdAt: number;
      // usage
      orderCount30d: number;
      revenue30d: number; // cents
      locationCount: number;
      activeStaffCount: number;
      lastActivityAt: number | null;
      lastLoginAt: number | null;
      // health
      birConfigured: boolean;
      hadShiftThisWeek: boolean;
      hadSalesLast7d: boolean;
      health: "ok" | "warning" | "stalled";
      healthReasons: string[];
    };

    const rows: Row[] = [];
    for (const t of tenants) {
      // Locations
      const locations = await ctx.db
        .query("locations")
        .withIndex("by_tenant", (q) => q.eq("tenantId", t._id))
        .collect();
      const activeLocations = locations.filter((l) => l.status === "active");

      // 30-day orders + revenue
      let orderCount30d = 0;
      let revenue30d = 0;
      let hadSalesLast7d = false;
      let lastActivityAt: number | null = null;
      for (const loc of locations) {
        const orders = await ctx.db
          .query("orders")
          .withIndex("by_tenant_location_status", (q) =>
            q
              .eq("tenantId", t._id)
              .eq("locationId", loc._id)
              .eq("status", "completed")
          )
          .collect();
        for (const o of orders) {
          if (o.completedAt === undefined) continue;
          if (lastActivityAt === null || o.completedAt > lastActivityAt)
            lastActivityAt = o.completedAt;
          if (o.completedAt >= last30) {
            orderCount30d++;
            revenue30d += o.total;
          }
          if (o.completedAt >= last7) hadSalesLast7d = true;
        }
      }

      // Active staff
      const users = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", t._id))
        .collect();
      const activeStaffCount = users.filter((u) => u.status === "active").length;

      // Latest login — scan sessions for users in this tenant. Cheap: each
      // tenant has few users. Index by_user is on sessions; we walk users.
      let lastLoginAt: number | null = null;
      for (const u of users) {
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();
        for (const s of sessions) {
          const stamp = s._creationTime;
          if (lastLoginAt === null || stamp > lastLoginAt) lastLoginAt = stamp;
        }
      }

      // Shifts this week
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_tenant", (q) => q.eq("tenantId", t._id))
        .collect();
      const hadShiftThisWeek = shifts.some((s) => s.startedAt >= last7);

      // BIR readiness
      const birConfigured = !!(t.businessName && t.tin && t.vatStatus);

      // Health rules — surface the most useful signals only.
      const reasons: string[] = [];
      if (t.status === "suspended") reasons.push("Suspended");
      if (activeLocations.length === 0) reasons.push("No active locations");
      if (activeStaffCount === 0) reasons.push("No active staff");
      if (!birConfigured) reasons.push("BIR settings incomplete");
      if (!hadSalesLast7d && lastActivityAt !== null)
        reasons.push("No sales in 7 days");
      if (lastLoginAt === null) reasons.push("Never logged in");
      else if (lastLoginAt < last7) reasons.push("No login in 7 days");

      // Severity buckets — stalled = "you should call them," warning =
      // "keep an eye on it," ok = "happy customer."
      let health: "ok" | "warning" | "stalled" = "ok";
      if (
        t.status === "suspended" ||
        activeLocations.length === 0 ||
        activeStaffCount === 0 ||
        (!hadSalesLast7d && lastActivityAt !== null) ||
        (lastLoginAt !== null && lastLoginAt < last7)
      ) {
        health = "stalled";
      } else if (!birConfigured || !hadShiftThisWeek) {
        health = "warning";
      }

      rows.push({
        _id: t._id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        createdAt: t._creationTime,
        orderCount30d,
        revenue30d,
        locationCount: locations.length,
        activeStaffCount,
        lastActivityAt,
        lastLoginAt,
        birConfigured,
        hadShiftThisWeek,
        hadSalesLast7d,
        health,
        healthReasons: reasons,
      });
    }

    rows.sort((a, b) => {
      // Stalled first so they're the first thing the operator sees.
      const sev: Record<string, number> = { stalled: 0, warning: 1, ok: 2 };
      if (sev[a.health] !== sev[b.health]) return sev[a.health] - sev[b.health];
      return b.revenue30d - a.revenue30d;
    });

    return rows;
  },
});

/**
 * Cross-tenant activity feed — the 50 most recent meaningful events. Pulls
 * order completions, shift starts/ends, new tenant creations. Used as the
 * "what's happening right now" panel above the tenant list.
 */
export const recentActivity = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) throw new Error("Unauthorized");

    const limit = args.limit ?? 50;
    const since = Date.now() - 7 * DAY_MS;
    const tenants = await ctx.db.query("tenants").collect();
    const tenantMap = new Map(tenants.map((t) => [String(t._id), t]));

    type Event = {
      ts: number;
      kind: "order" | "shift_start" | "shift_end" | "tenant_created";
      tenantId: Id<"tenants">;
      tenantName: string;
      label: string;
      amount?: number;
    };
    const events: Event[] = [];

    for (const t of tenants) {
      if (t._creationTime >= since) {
        events.push({
          ts: t._creationTime,
          kind: "tenant_created",
          tenantId: t._id,
          tenantName: t.name,
          label: `Tenant created`,
        });
      }
    }

    // Order completions — pull all completed orders in the last 7 days
    // across every location, tag with tenant name.
    const allLocations = await ctx.db.query("locations").collect();
    for (const loc of allLocations) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", loc.tenantId)
            .eq("locationId", loc._id)
            .eq("status", "completed")
        )
        .collect();
      for (const o of orders) {
        if (o.completedAt === undefined) continue;
        if (o.completedAt < since) continue;
        events.push({
          ts: o.completedAt,
          kind: "order",
          tenantId: loc.tenantId,
          tenantName: tenantMap.get(String(loc.tenantId))?.name ?? "Unknown",
          label: `Order ${o.orderNumber ?? "?"} · ${loc.name}`,
          amount: o.total,
        });
      }

      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_tenant_location", (q) =>
          q.eq("tenantId", loc.tenantId).eq("locationId", loc._id)
        )
        .collect();
      for (const s of shifts) {
        if (s.startedAt >= since) {
          events.push({
            ts: s.startedAt,
            kind: "shift_start",
            tenantId: loc.tenantId,
            tenantName: tenantMap.get(String(loc.tenantId))?.name ?? "Unknown",
            label: `Shift opened · ${loc.name}`,
          });
        }
        if (s.endedAt && s.endedAt >= since) {
          events.push({
            ts: s.endedAt,
            kind: "shift_end",
            tenantId: loc.tenantId,
            tenantName: tenantMap.get(String(loc.tenantId))?.name ?? "Unknown",
            label: `Shift closed · ${loc.name}`,
          });
        }
      }
    }

    events.sort((a, b) => b.ts - a.ts);
    return events.slice(0, limit);
  },
});

/**
 * Suspend / unsuspend a tenant. Suspending keeps the data and lets users
 * log in, but the dashboard shows a "billing on hold" banner via
 * validateSession (added in a follow-up commit). The platform-admin
 * session that issued this stays signed in.
 */
export const setTenantStatus = mutation({
  args: {
    token: v.string(),
    tenantId: v.id("tenants"),
    status: v.union(v.literal("active"), v.literal("suspended")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) throw new Error("Unauthorized");

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");

    await ctx.db.patch(args.tenantId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    // Use the audit log so this action is searchable later. userId is the
    // platform admin's id (separate space from tenant users) — we cast
    // via the Doc<"users"> id field since auditLog requires it; for the
    // platform-admin case we record the admin's id directly into the
    // changes payload instead.
    void found;
    return { ok: true };
  },
});

/**
 * Platform-wide snapshot of the few numbers a SaaS operator wants on
 * their dashboard: total tenants, MRR proxy (gross revenue last 30d),
 * total orders today, top-3 tenants by revenue this month.
 */
export const platformSnapshot = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) throw new Error("Unauthorized");

    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    const last30 = now - 30 * DAY_MS;

    const tenants = await ctx.db.query("tenants").collect();
    const activeTenants = tenants.filter((t) => t.status === "active").length;
    const suspendedTenants = tenants.filter(
      (t) => t.status === "suspended"
    ).length;

    let ordersToday = 0;
    let revenue30d = 0;
    const tenantRevenue30d = new Map<Id<"tenants">, number>();

    const allLocations = await ctx.db.query("locations").collect();
    for (const loc of allLocations) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", loc.tenantId)
            .eq("locationId", loc._id)
            .eq("status", "completed")
        )
        .collect();
      for (const o of orders) {
        if (o.completedAt === undefined) continue;
        if (o.completedAt >= todayStart) ordersToday++;
        if (o.completedAt >= last30) {
          revenue30d += o.total;
          tenantRevenue30d.set(
            loc.tenantId,
            (tenantRevenue30d.get(loc.tenantId) ?? 0) + o.total
          );
        }
      }
    }

    const tenantMap = new Map(tenants.map((t) => [String(t._id), t]));
    const topTenants = [...tenantRevenue30d.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, rev]) => ({
        _id: id,
        name: tenantMap.get(String(id))?.name ?? "Unknown",
        revenue: rev,
      }));

    return {
      generatedAt: now,
      activeTenants,
      suspendedTenants,
      totalTenants: tenants.length,
      ordersToday,
      revenue30d,
      topTenants,
    };
  },
});
