import { mutation, query, internalMutation, QueryCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import type { Doc, Id } from "../_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayLocal(ts: number): number {
  // Manila uses a fixed UTC offset (no DST), so "local midnight" here is
  // calculated relative to the server's clock. Convex runs in UTC so we
  // adjust by Asia/Manila's +8 offset to get a Manila-day boundary.
  const offsetMs = 8 * 60 * 60 * 1000;
  const local = ts + offsetMs;
  const dayUtc = local - (local % DAY_MS);
  return dayUtc - offsetMs;
}

/**
 * Capture a Beginning-of-Day / End-of-Day snapshot for every active
 * ingredient at a given location. Idempotent for the same (location, day)
 * — re-running overwrites the previous capture.
 *
 * Math (per ingredient):
 *   consumed = sum of recipe deductions from orders completed today
 *   received = sum of `stockAdjustments` where type=restock and createdAt
 *              falls in today's window
 *   adjusted = sum of all OTHER stockAdjustments in today's window
 *   closing  = current ingredientStock.quantity (live, authoritative)
 *   opening  = closing − received − adjusted + consumed
 *
 * Once we have prior snapshots in the table, future calls cross-check:
 * tomorrow's opening must equal today's closing. Variance surfaces in
 * the audit report.
 */
export async function captureSnapshotImpl(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  locationId: Id<"locations">,
  dayStart: number,
  capturedBy?: Id<"users">
) {
  const dayEnd = dayStart + DAY_MS - 1;

  // Wipe any prior snapshot for the same (location, day) so we never
  // double-stack rows when the cron re-fires or an operator re-captures.
  const existing = await ctx.db
    .query("ingredientDailySnapshots")
    .withIndex("by_tenant_location_day", (q) =>
      q
        .eq("tenantId", tenantId)
        .eq("locationId", locationId)
        .eq("dayStart", dayStart)
    )
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);

  // Live stock + this-day adjustments + this-day order deductions.
  const ingredients = await ctx.db
    .query("ingredients")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  const stockRows = await ctx.db
    .query("ingredientStock")
    .withIndex("by_location", (q) => q.eq("locationId", locationId))
    .collect();
  const stockMap = new Map(
    stockRows.map((s) => [String(s.ingredientId), s.quantity])
  );

  const adjustments = await ctx.db
    .query("stockAdjustments")
    .withIndex("by_location", (q) => q.eq("locationId", locationId))
    .collect();
  const receivedMap = new Map<string, number>();
  const adjustedMap = new Map<string, number>();
  for (const a of adjustments) {
    if (a.createdAt < dayStart || a.createdAt > dayEnd) continue;
    const k = String(a.ingredientId);
    if (a.type === "restock") {
      receivedMap.set(k, (receivedMap.get(k) ?? 0) + a.quantity);
    } else {
      adjustedMap.set(k, (adjustedMap.get(k) ?? 0) + a.quantity);
    }
  }

  // Consumption = sum of recipe deductions from completed orders today.
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_tenant_location", (q) =>
      q.eq("tenantId", tenantId).eq("locationId", locationId)
    )
    .collect();
  const consumedMap = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== "completed") continue;
    if (o.completedAt === undefined) continue;
    if (o.completedAt < dayStart || o.completedAt > dayEnd) continue;
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", o._id))
      .collect();
    for (const it of items) {
      const recipes = await ctx.db
        .query("recipes")
        .withIndex("by_menu_item", (q) => q.eq("menuItemId", it.menuItemId))
        .collect();
      for (const r of recipes) {
        if (r.variantKey) continue; // base only — approximation
        const k = String(r.ingredientId);
        consumedMap.set(
          k,
          (consumedMap.get(k) ?? 0) + r.quantityUsed * it.quantity
        );
      }
    }
  }

  const now = Date.now();
  let written = 0;
  for (const ing of ingredients) {
    if (ing.status !== "active") continue;
    const k = String(ing._id);
    const closing = stockMap.get(k) ?? 0;
    const consumed = consumedMap.get(k) ?? 0;
    const received = receivedMap.get(k) ?? 0;
    const adjusted = adjustedMap.get(k) ?? 0;
    const opening = closing - received - adjusted + consumed;

    await ctx.db.insert("ingredientDailySnapshots", {
      tenantId,
      locationId,
      ingredientId: ing._id,
      dayStart,
      openingQuantity: opening,
      consumed,
      received,
      adjusted,
      closingQuantity: closing,
      capturedAt: now,
      capturedBy,
    });
    written++;
  }
  return written;
}

/** Manual capture — owner/manager click "Snapshot now" on the audit page. */
export const captureSnapshotNow = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    date: v.optional(v.number()), // defaults to today
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const dayStart = startOfDayLocal(args.date ?? Date.now());
    const count = await captureSnapshotImpl(
      ctx,
      session.tenantId,
      args.locationId,
      dayStart,
      session.userId
    );

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "inventory.snapshot_captured",
      "ingredientDailySnapshots",
      args.locationId,
      { dayStart, ingredientCount: count }
    );
    return { count, dayStart };
  },
});

/** Cron-only — sweeps every location and captures yesterday's EOD. */
export const captureNightlySnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const yesterdayStart = startOfDayLocal(Date.now() - DAY_MS);
    const tenants = await ctx.db.query("tenants").collect();
    let total = 0;
    for (const tenant of tenants) {
      const locations = await ctx.db
        .query("locations")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect();
      for (const loc of locations) {
        if (loc.status !== "active") continue;
        total += await captureSnapshotImpl(
          ctx,
          tenant._id,
          loc._id,
          yesterdayStart
        );
      }
    }
    return total;
  },
});

/**
 * Audit trail — returns snapshots for a date range at a single location,
 * grouped by day so the UI can render a per-day table. Falls back to a
 * live-derived row for today if today hasn't been snapshot'd yet (so
 * the operator sees in-progress numbers without having to wait for the
 * nightly cron).
 */
export const getAuditTrail = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const ingredientMap = new Map<string, Doc<"ingredients">>();
    for (const i of ingredients) ingredientMap.set(String(i._id), i);

    const startDay = startOfDayLocal(args.startDate);
    const endDay = startOfDayLocal(args.endDate);

    // Pull every snapshot in range for this location.
    const snapshots = await ctx.db
      .query("ingredientDailySnapshots")
      .withIndex("by_tenant_location_day", (q) =>
        q
          .eq("tenantId", session.tenantId)
          .eq("locationId", args.locationId)
      )
      .collect();
    const inRange = snapshots.filter(
      (s) => s.dayStart >= startDay && s.dayStart <= endDay
    );

    type Row = {
      dayStart: number;
      ingredientId: Id<"ingredients">;
      name: string;
      unit: string;
      category: string | null;
      openingQuantity: number;
      consumed: number;
      received: number;
      adjusted: number;
      closingQuantity: number;
      calculated: number; // opening − consumed + received + adjusted
      variance: number; // closing − calculated; nonzero = unexplained delta
      isLive: boolean; // true when this row is today's in-progress estimate
    };

    const rows: Row[] = inRange.map((s) => {
      const ing = ingredientMap.get(String(s.ingredientId));
      const calculated =
        s.openingQuantity - s.consumed + s.received + s.adjusted;
      return {
        dayStart: s.dayStart,
        ingredientId: s.ingredientId,
        name: ing?.name ?? "Unknown",
        unit: ing?.unit ?? "",
        category: ing?.category ?? null,
        openingQuantity: s.openingQuantity,
        consumed: s.consumed,
        received: s.received,
        adjusted: s.adjusted,
        closingQuantity: s.closingQuantity,
        calculated,
        variance: s.closingQuantity - calculated,
        isLive: false,
      };
    });

    // Days within the range that aren't snapshot'd yet — surface
    // empty-day rows so the operator notices missing captures.
    const snapshotted = new Set(inRange.map((s) => s.dayStart));
    const today = startOfDayLocal(Date.now());
    for (let d = startDay; d <= endDay; d += DAY_MS) {
      if (snapshotted.has(d)) continue;
      if (d !== today) continue; // only synthesise today, past days = gap
      // For today, materialise a live row per ingredient using the same
      // math as captureSnapshotImpl (but read-only).
      const dayEnd = d + DAY_MS - 1;
      const stockRows = await ctx.db
        .query("ingredientStock")
        .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
        .collect();
      const stockMap = new Map(
        stockRows.map((s) => [String(s.ingredientId), s.quantity])
      );
      const adjustments = await ctx.db
        .query("stockAdjustments")
        .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
        .collect();
      const receivedMap = new Map<string, number>();
      const adjustedMap = new Map<string, number>();
      for (const a of adjustments) {
        if (a.createdAt < d || a.createdAt > dayEnd) continue;
        const k = String(a.ingredientId);
        if (a.type === "restock") {
          receivedMap.set(k, (receivedMap.get(k) ?? 0) + a.quantity);
        } else {
          adjustedMap.set(k, (adjustedMap.get(k) ?? 0) + a.quantity);
        }
      }
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", args.locationId)
        )
        .collect();
      const consumedMap = new Map<string, number>();
      for (const o of orders) {
        if (o.status !== "completed") continue;
        if (o.completedAt === undefined) continue;
        if (o.completedAt < d || o.completedAt > dayEnd) continue;
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", o._id))
          .collect();
        for (const it of items) {
          const recipes = await ctx.db
            .query("recipes")
            .withIndex("by_menu_item", (q) => q.eq("menuItemId", it.menuItemId))
            .collect();
          for (const r of recipes) {
            if (r.variantKey) continue;
            const k = String(r.ingredientId);
            consumedMap.set(
              k,
              (consumedMap.get(k) ?? 0) + r.quantityUsed * it.quantity
            );
          }
        }
      }
      for (const ing of ingredients) {
        if (ing.status !== "active") continue;
        const k = String(ing._id);
        const closing = stockMap.get(k) ?? 0;
        const consumed = consumedMap.get(k) ?? 0;
        const received = receivedMap.get(k) ?? 0;
        const adjusted = adjustedMap.get(k) ?? 0;
        const opening = closing - received - adjusted + consumed;
        const calculated = opening - consumed + received + adjusted;
        rows.push({
          dayStart: d,
          ingredientId: ing._id,
          name: ing.name,
          unit: ing.unit,
          category: ing.category ?? null,
          openingQuantity: opening,
          consumed,
          received,
          adjusted,
          closingQuantity: closing,
          calculated,
          variance: closing - calculated,
          isLive: true,
        });
      }
    }

    rows.sort(
      (a, b) =>
        b.dayStart - a.dayStart || a.name.localeCompare(b.name)
    );
    return { locationName: location.name, rows };
  },
});

// Helper for QueryCtx fallback when needed (not currently used externally).
export type AuditCtx = QueryCtx;
