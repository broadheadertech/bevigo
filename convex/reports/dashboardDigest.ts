import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * One-shot dashboard digest for owners and managers. Bundles today's
 * snapshot, low-stock + out-of-stock counts, top sellers today, parked
 * order count, open shifts, and a curated list of "things to look at"
 * reminders so the admin can land on / and immediately know what needs
 * their attention.
 *
 * Optional locationId narrows the scope. With no locationId, owners see
 * everything in their tenant; managers see their assigned locations.
 */
export const getDashboardDigest = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds: Id<"locations">[] = args.locationId
      ? [args.locationId]
      : session.role === "owner"
        ? (
            await ctx.db
              .query("locations")
              .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
              .collect()
          ).map((l) => l._id)
        : session.locationIds;

    const now = new Date();
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

    // ── Today's sales across selected locations ──
    let revenue = 0;
    let orderCount = 0;
    let refundCount = 0;
    let voidCount = 0;
    const itemTotals = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    let parkedCount = 0;
    let openShiftCount = 0;
    const hourly = new Array(24).fill(0).map(() => ({ orders: 0 }));

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location", (q) =>
          q.eq("tenantId", session.tenantId).eq("locationId", locId)
        )
        .collect();
      for (const o of orders) {
        if (o.status === "draft") {
          parkedCount++;
          continue;
        }
        if (o.completedAt === undefined) continue;
        if (o.completedAt < dayStart || o.completedAt > dayEnd) continue;

        const h = new Date(o.completedAt).getHours();
        hourly[h].orders++;

        if (o.status === "voided") {
          voidCount++;
          continue;
        }
        if (o.refundedAt && o.refundedAt >= dayStart && o.refundedAt <= dayEnd) {
          refundCount++;
          continue;
        }

        revenue += o.total;
        orderCount++;

        // Aggregate items for top-sellers
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", o._id))
          .collect();
        for (const it of items) {
          const cur = itemTotals.get(it.itemName) ?? {
            name: it.itemName,
            qty: 0,
            revenue: 0,
          };
          cur.qty += it.quantity;
          cur.revenue += it.subtotal;
          itemTotals.set(it.itemName, cur);
        }
      }

      // Open shifts at this location
      const openShifts = await ctx.db
        .query("shifts")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "active")
        )
        .collect();
      openShiftCount += openShifts.length;
    }

    let peakHour = 0;
    for (let h = 1; h < 24; h++) {
      if (hourly[h].orders > hourly[peakHour].orders) peakHour = h;
    }

    const topSellers = [...itemTotals.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // ── Low / out-of-stock ingredients across selected locations ──
    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const allStock = await ctx.db
      .query("ingredientStock")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const stockByLocation = new Map<string, Map<string, number>>();
    for (const s of allStock) {
      const locKey = String(s.locationId);
      if (!stockByLocation.has(locKey)) stockByLocation.set(locKey, new Map());
      stockByLocation.get(locKey)!.set(String(s.ingredientId), s.quantity);
    }

    type LowStockRow = {
      ingredientId: Id<"ingredients">;
      name: string;
      unit: string;
      onHand: number;
      reorderThreshold: number;
      isOut: boolean;
      locationId: Id<"locations">;
      locationName: string;
    };
    const lowStock: LowStockRow[] = [];
    const locationsById = new Map<string, Doc<"locations">>();
    for (const locId of locationIds) {
      const loc = await ctx.db.get(locId);
      if (loc) locationsById.set(String(locId), loc);
    }
    for (const ing of ingredients) {
      if (ing.status !== "active") continue;
      for (const locId of locationIds) {
        const onHand = stockByLocation.get(String(locId))?.get(String(ing._id)) ?? 0;
        if (onHand < ing.reorderThreshold) {
          lowStock.push({
            ingredientId: ing._id,
            name: ing.name,
            unit: ing.unit,
            onHand,
            reorderThreshold: ing.reorderThreshold,
            isOut: onHand <= 0,
            locationId: locId,
            locationName: locationsById.get(String(locId))?.name ?? "Unknown",
          });
        }
      }
    }
    lowStock.sort((a, b) => a.onHand - b.onHand);

    // ── Reminders ──
    type Reminder = {
      kind:
        | "low_stock"
        | "out_of_stock"
        | "parked"
        | "open_shift"
        | "refund"
        | "void"
        | "no_sales";
      severity: "high" | "medium" | "low";
      title: string;
      detail: string;
      href?: string;
    };
    const reminders: Reminder[] = [];

    const outCount = lowStock.filter((r) => r.isOut).length;
    const lowOnly = lowStock.length - outCount;
    if (outCount > 0) {
      reminders.push({
        kind: "out_of_stock",
        severity: "high",
        title: `${outCount} ingredient${outCount === 1 ? "" : "s"} out of stock`,
        detail:
          lowStock
            .filter((r) => r.isOut)
            .slice(0, 3)
            .map((r) => r.name)
            .join(", ") + (outCount > 3 ? ", …" : ""),
        href: "/inventory",
      });
    }
    if (lowOnly > 0) {
      reminders.push({
        kind: "low_stock",
        severity: "medium",
        title: `${lowOnly} ingredient${lowOnly === 1 ? "" : "s"} below reorder threshold`,
        detail:
          lowStock
            .filter((r) => !r.isOut)
            .slice(0, 3)
            .map((r) => `${r.name} (${r.onHand.toFixed(1)}${r.unit})`)
            .join(", ") + (lowOnly > 3 ? ", …" : ""),
        href: "/inventory",
      });
    }
    if (parkedCount > 0) {
      reminders.push({
        kind: "parked",
        severity: parkedCount > 5 ? "medium" : "low",
        title: `${parkedCount} parked order${parkedCount === 1 ? "" : "s"} waiting`,
        detail: "Open the register to close them out or cancel.",
        href: "/order",
      });
    }
    if (openShiftCount > 0) {
      reminders.push({
        kind: "open_shift",
        severity: "low",
        title: `${openShiftCount} active shift${openShiftCount === 1 ? "" : "s"}`,
        detail: "End-of-day reconciliation pending.",
        href: "/order",
      });
    }
    if (refundCount > 0) {
      reminders.push({
        kind: "refund",
        severity: "medium",
        title: `${refundCount} refund${refundCount === 1 ? "" : "s"} today`,
        detail: "Review on the order history page.",
        href: "/orders",
      });
    }
    if (voidCount > 0) {
      reminders.push({
        kind: "void",
        severity: "low",
        title: `${voidCount} voided order${voidCount === 1 ? "" : "s"} today`,
        detail: "Worth a glance to spot accidental voids.",
        href: "/reports",
      });
    }
    if (orderCount === 0 && new Date().getHours() >= 11) {
      reminders.push({
        kind: "no_sales",
        severity: "high",
        title: "No completed sales yet today",
        detail:
          "It's past 11 — confirm the register is set up and a shift is open.",
        href: "/order",
      });
    }
    reminders.sort((a, b) => {
      const o = { high: 0, medium: 1, low: 2 } as const;
      return o[a.severity] - o[b.severity];
    });

    return {
      generatedAt: Date.now(),
      windowStart: dayStart,
      sales: {
        revenue,
        orderCount,
        avgTicket: orderCount > 0 ? revenue / orderCount : 0,
        refundCount,
        voidCount,
      },
      products: {
        topSellers,
      },
      operations: {
        peakHour,
        peakHourOrders: hourly[peakHour].orders,
        parkedCount,
        openShiftCount,
      },
      lowStock: lowStock.slice(0, 12),
      lowStockCount: lowStock.length,
      outOfStockCount: outCount,
      reminders,
    };
  },
});

/**
 * Lightweight, single-operator digest for baristas. Hides tenant-wide
 * revenue but surfaces the things a barista can act on: their own orders
 * today, their active shift (or lack of one), parked orders they own, and
 * low-stock alerts at their assigned locations so they can flag them up.
 */
export const getBaristaDigest = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const now = new Date();
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

    // The barista's own orders today, across every location they have access to.
    let myOrderCount = 0;
    let myItemsSold = 0;
    let myParkedCount = 0;
    let myActiveShiftId: Id<"shifts"> | null = null;
    let myActiveShiftStart: number | null = null;

    for (const locId of session.locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location", (q) =>
          q.eq("tenantId", session.tenantId).eq("locationId", locId)
        )
        .collect();
      for (const o of orders) {
        if (o.userId !== session.userId) continue;
        if (o.status === "draft") {
          myParkedCount++;
          continue;
        }
        if (
          o.status === "completed" &&
          o.completedAt !== undefined &&
          o.completedAt >= dayStart &&
          o.completedAt <= dayEnd &&
          !o.refundedAt
        ) {
          myOrderCount++;
          const items = await ctx.db
            .query("orderItems")
            .withIndex("by_order", (q) => q.eq("orderId", o._id))
            .collect();
          for (const it of items) myItemsSold += it.quantity;
        }
      }

      // Active shift owned by this user
      const activeShifts = await ctx.db
        .query("shifts")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "active")
        )
        .collect();
      const mine = activeShifts.find((s) => s.userId === session.userId);
      if (mine && !myActiveShiftId) {
        myActiveShiftId = mine._id;
        myActiveShiftStart = mine.startedAt;
      }
    }

    // Low-stock at their assigned locations
    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const allStock = await ctx.db
      .query("ingredientStock")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const stockByLocation = new Map<string, Map<string, number>>();
    for (const s of allStock) {
      const locKey = String(s.locationId);
      if (!stockByLocation.has(locKey)) stockByLocation.set(locKey, new Map());
      stockByLocation.get(locKey)!.set(String(s.ingredientId), s.quantity);
    }
    type LowStock = {
      ingredientId: Id<"ingredients">;
      name: string;
      unit: string;
      onHand: number;
      reorderThreshold: number;
      isOut: boolean;
    };
    const lowStock: LowStock[] = [];
    for (const ing of ingredients) {
      if (ing.status !== "active") continue;
      // Treat the ingredient as low if ANY of the operator's assigned
      // locations is below threshold — they need to know either way.
      let lowestQty = Infinity;
      for (const locId of session.locationIds) {
        const onHand =
          stockByLocation.get(String(locId))?.get(String(ing._id)) ?? 0;
        if (onHand < lowestQty) lowestQty = onHand;
      }
      if (lowestQty === Infinity) continue;
      if (lowestQty < ing.reorderThreshold) {
        lowStock.push({
          ingredientId: ing._id,
          name: ing.name,
          unit: ing.unit,
          onHand: lowestQty,
          reorderThreshold: ing.reorderThreshold,
          isOut: lowestQty <= 0,
        });
      }
    }
    lowStock.sort((a, b) => a.onHand - b.onHand);

    type Reminder = {
      severity: "high" | "medium" | "low";
      title: string;
      detail: string;
      href?: string;
    };
    const reminders: Reminder[] = [];
    if (myActiveShiftId === null) {
      reminders.push({
        severity: "high",
        title: "No active shift",
        detail: "Open the register and tap Start Shift before taking orders.",
        href: "/order",
      });
    }
    if (myParkedCount > 0) {
      reminders.push({
        severity: "medium",
        title: `${myParkedCount} parked order${myParkedCount === 1 ? "" : "s"}`,
        detail: "Close them out or cancel from the register.",
        href: "/order",
      });
    }
    const outCount = lowStock.filter((r) => r.isOut).length;
    if (outCount > 0) {
      reminders.push({
        severity: "high",
        title: `${outCount} ingredient${outCount === 1 ? "" : "s"} out of stock`,
        detail: lowStock
          .filter((r) => r.isOut)
          .slice(0, 3)
          .map((r) => r.name)
          .join(", "),
      });
    }
    const lowOnly = lowStock.length - outCount;
    if (lowOnly > 0) {
      reminders.push({
        severity: "low",
        title: `${lowOnly} ingredient${lowOnly === 1 ? "" : "s"} running low`,
        detail: lowStock
          .filter((r) => !r.isOut)
          .slice(0, 3)
          .map((r) => `${r.name} (${r.onHand.toFixed(1)}${r.unit})`)
          .join(", "),
      });
    }
    reminders.sort((a, b) => {
      const o = { high: 0, medium: 1, low: 2 } as const;
      return o[a.severity] - o[b.severity];
    });

    return {
      generatedAt: Date.now(),
      myOrderCount,
      myItemsSold,
      myParkedCount,
      myActiveShiftId,
      myActiveShiftStart,
      lowStock: lowStock.slice(0, 8),
      lowStockCount: lowStock.length,
      outOfStockCount: outCount,
      reminders,
    };
  },
});
