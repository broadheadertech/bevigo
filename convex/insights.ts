import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Insights = the four classic analytics levels packaged for one shop:
 *   descriptive   — what happened in the last 7 days
 *   diagnostic    — why it changed vs the prior 7 days
 *   predictive    — what's likely next 7 days based on recent trend
 *   prescriptive  — concrete actions worth taking now
 *
 * All windows are tenant + location scoped. Period defaults to a rolling
 * 7-day window ending now; clients can pass dayCount to widen it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type CompletedOrder = Doc<"orders">;

async function fetchCompletedOrders(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  locationId: Id<"locations">,
  windowStart: number,
  windowEnd: number
): Promise<CompletedOrder[]> {
  const all = await ctx.db
    .query("orders")
    .withIndex("by_tenant_location", (q) =>
      q.eq("tenantId", tenantId).eq("locationId", locationId)
    )
    .collect();
  return all.filter(
    (o: CompletedOrder) =>
      o.status === "completed" &&
      !o.refundedAt &&
      o.completedAt !== undefined &&
      o.completedAt >= windowStart &&
      o.completedAt <= windowEnd
  );
}

function startOfDayLocal(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function pct(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null; // null = "no baseline"
  return ((now - before) / before) * 100;
}

// ─────────────────── DESCRIPTIVE ───────────────────

export const getDescriptive = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    dayCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    requireLocationAccess(session, args.locationId);

    const dayCount = Math.min(Math.max(args.dayCount ?? 7, 1), 60);
    const now = Date.now();
    const windowStart = startOfDayLocal(now - (dayCount - 1) * DAY_MS);

    const orders = await fetchCompletedOrders(
      ctx,
      session.tenantId,
      args.locationId,
      windowStart,
      now
    );

    // Totals
    const orderCount = orders.length;
    const grossTotal = orders.reduce((s, o) => s + o.total, 0);
    const taxTotal = orders.reduce((s, o) => s + o.taxAmount, 0);
    const netTotal = grossTotal - taxTotal;
    const avgTicket = orderCount > 0 ? grossTotal / orderCount : 0;

    // Tender mix
    let cash = 0, card = 0, ewallet = 0;
    for (const o of orders) {
      if (o.payments && o.payments.length > 0) {
        for (const p of o.payments) {
          if (p.type === "cash") cash += p.amount;
          else if (p.type === "card") card += p.amount;
          else if (p.type === "ewallet") ewallet += p.amount;
        }
      } else if (o.paymentType === "cash") cash += o.total;
      else if (o.paymentType === "card") card += o.total;
      else if (o.paymentType === "ewallet") ewallet += o.total;
    }

    // Per-day sales
    const byDay = new Map<number, { revenue: number; orders: number }>();
    for (let i = 0; i < dayCount; i++) {
      byDay.set(startOfDayLocal(now - i * DAY_MS), { revenue: 0, orders: 0 });
    }
    for (const o of orders) {
      const day = startOfDayLocal(o.completedAt as number);
      const slot = byDay.get(day);
      if (slot) {
        slot.revenue += o.total;
        slot.orders += 1;
      }
    }
    const dailySeries = [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, v]) => ({ day, ...v }));

    // Per-hour distribution (peak)
    const hourly = new Array(24).fill(0).map(() => ({ revenue: 0, orders: 0 }));
    for (const o of orders) {
      const h = new Date(o.completedAt as number).getHours();
      hourly[h].revenue += o.total;
      hourly[h].orders += 1;
    }
    let peakHour = 0;
    for (let h = 1; h < 24; h++) {
      if (hourly[h].orders > hourly[peakHour].orders) peakHour = h;
    }

    // Top items by revenue (cap at 5)
    const itemTotals = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of orders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", o._id))
        .collect();
      for (const it of items) {
        const cur = itemTotals.get(it.itemName) ?? { name: it.itemName, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += it.subtotal;
        itemTotals.set(it.itemName, cur);
      }
    }
    const topItems = [...itemTotals.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      dayCount,
      windowStart,
      windowEnd: now,
      orderCount,
      grossTotal,
      netTotal,
      taxTotal,
      avgTicket,
      tender: { cash, card, ewallet },
      dailySeries,
      peakHour,
      peakHourOrders: hourly[peakHour].orders,
      topItems,
    };
  },
});

// ─────────────────── DIAGNOSTIC ───────────────────

export const getDiagnostic = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    dayCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    requireLocationAccess(session, args.locationId);

    const dayCount = Math.min(Math.max(args.dayCount ?? 7, 1), 30);
    const now = Date.now();
    const periodMs = dayCount * DAY_MS;
    const currentStart = startOfDayLocal(now - (dayCount - 1) * DAY_MS);
    const previousEnd = currentStart - 1;
    const previousStart = startOfDayLocal(currentStart - periodMs);

    const [current, previous] = await Promise.all([
      fetchCompletedOrders(ctx, session.tenantId, args.locationId, currentStart, now),
      fetchCompletedOrders(ctx, session.tenantId, args.locationId, previousStart, previousEnd),
    ]);

    const sumRevenue = (rows: CompletedOrder[]) => rows.reduce((s, o) => s + o.total, 0);
    const currentRev = sumRevenue(current);
    const previousRev = sumRevenue(previous);

    // Per-item revenue change
    const itemRev = async (rows: CompletedOrder[]): Promise<Map<string, number>> => {
      const totals = new Map<string, number>();
      for (const o of rows) {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", o._id))
          .collect();
        for (const it of items) {
          totals.set(it.itemName, (totals.get(it.itemName) ?? 0) + it.subtotal);
        }
      }
      return totals;
    };
    const [curItems, prevItems] = await Promise.all([itemRev(current), itemRev(previous)]);
    const allNames = new Set<string>([...curItems.keys(), ...prevItems.keys()]);
    const itemDeltas: Array<{ name: string; current: number; previous: number; delta: number }> = [];
    for (const name of allNames) {
      const c = curItems.get(name) ?? 0;
      const p = prevItems.get(name) ?? 0;
      itemDeltas.push({ name, current: c, previous: p, delta: c - p });
    }
    itemDeltas.sort((a, b) => b.delta - a.delta);
    const gainers = itemDeltas.slice(0, 5).filter((d) => d.delta > 0);
    const losers = itemDeltas.slice(-5).filter((d) => d.delta < 0).reverse();

    // Peak-hour shift
    const hourCounts = (rows: CompletedOrder[]) => {
      const arr = new Array(24).fill(0);
      for (const o of rows) arr[new Date(o.completedAt as number).getHours()]++;
      return arr;
    };
    const argmax = (arr: number[]) => arr.reduce((best, v, i) => (v > arr[best] ? i : best), 0);
    const curHour = argmax(hourCounts(current));
    const prevHour = argmax(hourCounts(previous));

    return {
      dayCount,
      currentStart,
      previousStart,
      previousEnd,
      currentRevenue: currentRev,
      previousRevenue: previousRev,
      revenueDelta: currentRev - previousRev,
      revenuePctChange: pct(currentRev, previousRev),
      currentOrderCount: current.length,
      previousOrderCount: previous.length,
      orderPctChange: pct(current.length, previous.length),
      gainers,
      losers,
      peakHourCurrent: curHour,
      peakHourPrevious: prevHour,
      peakHourShifted: curHour !== prevHour,
    };
  },
});

// ─────────────────── PREDICTIVE ───────────────────

export const getPredictive = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    /** Days of history to base the forecast on. */
    historyDays: v.optional(v.number()),
    /** Days into the future to project. */
    forecastDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    requireLocationAccess(session, args.locationId);

    const historyDays = Math.min(Math.max(args.historyDays ?? 14, 7), 60);
    const forecastDays = Math.min(Math.max(args.forecastDays ?? 7, 1), 30);
    const now = Date.now();
    const windowStart = startOfDayLocal(now - (historyDays - 1) * DAY_MS);

    const orders = await fetchCompletedOrders(
      ctx,
      session.tenantId,
      args.locationId,
      windowStart,
      now
    );

    // Daily revenue series
    const byDay = new Map<number, number>();
    for (let i = 0; i < historyDays; i++) {
      byDay.set(startOfDayLocal(now - i * DAY_MS), 0);
    }
    for (const o of orders) {
      const day = startOfDayLocal(o.completedAt as number);
      byDay.set(day, (byDay.get(day) ?? 0) + o.total);
    }
    const series = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r);

    // 7-day moving average forecast (or shorter when not enough history)
    const window = Math.min(7, series.length);
    const recent = series.slice(-window);
    const avg = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
    const projection: Array<{ day: number; forecast: number }> = [];
    for (let i = 1; i <= forecastDays; i++) {
      projection.push({ day: startOfDayLocal(now + i * DAY_MS), forecast: avg });
    }
    const forecastTotal = avg * forecastDays;

    // Ingredient depletion forecast
    const totalConsumption = new Map<string, number>(); // ingredientId -> qty consumed in window
    for (const o of orders) {
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
          // Skip variant-specific rows for simplicity — base recipe is enough
          // for a usage estimate.
          if (r.variantKey) continue;
          const k = String(r.ingredientId);
          totalConsumption.set(k, (totalConsumption.get(k) ?? 0) + r.quantityUsed * it.quantity);
        }
      }
    }

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const stockRows = await ctx.db
      .query("ingredientStock")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();
    const stockMap = new Map(stockRows.map((s) => [String(s.ingredientId), s.quantity]));

    const depletions: Array<{
      ingredientId: Id<"ingredients">;
      name: string;
      unit: string;
      onHand: number;
      dailyUsage: number;
      daysLeft: number;
      reorderThreshold: number;
    }> = [];
    for (const ing of ingredients) {
      if (ing.status !== "active") continue;
      const used = totalConsumption.get(String(ing._id)) ?? 0;
      if (used <= 0) continue;
      const dailyUsage = used / historyDays;
      const onHand = stockMap.get(String(ing._id)) ?? 0;
      const daysLeft = dailyUsage > 0 ? onHand / dailyUsage : Infinity;
      depletions.push({
        ingredientId: ing._id,
        name: ing.name,
        unit: ing.unit,
        onHand,
        dailyUsage,
        daysLeft,
        reorderThreshold: ing.reorderThreshold,
      });
    }
    depletions.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      historyDays,
      forecastDays,
      historicalAvgDailyRevenue: avg,
      forecastTotal,
      projection,
      depletions: depletions.slice(0, 10),
    };
  },
});

// ─────────────────── PRESCRIPTIVE ───────────────────

export const getPrescriptive = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    requireLocationAccess(session, args.locationId);

    type Action = {
      kind: "reorder" | "promote" | "deactivate" | "staffing" | "modifier";
      severity: "high" | "medium" | "low";
      title: string;
      detail: string;
    };

    const actions: Action[] = [];

    // ── Reorder: ingredients projected to hit threshold within 7 days ──
    const historyDays = 14;
    const now = Date.now();
    const windowStart = startOfDayLocal(now - (historyDays - 1) * DAY_MS);
    const orders = await fetchCompletedOrders(
      ctx,
      session.tenantId,
      args.locationId,
      windowStart,
      now
    );

    const totalConsumption = new Map<string, number>();
    for (const o of orders) {
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
          totalConsumption.set(k, (totalConsumption.get(k) ?? 0) + r.quantityUsed * it.quantity);
        }
      }
    }

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const stockRows = await ctx.db
      .query("ingredientStock")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();
    const stockMap = new Map(stockRows.map((s) => [String(s.ingredientId), s.quantity]));
    const supplierMap = new Map<string, string>();
    const supplierRows = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    for (const s of supplierRows) supplierMap.set(String(s._id), s.name);

    for (const ing of ingredients) {
      if (ing.status !== "active") continue;
      const onHand = stockMap.get(String(ing._id)) ?? 0;
      const used = totalConsumption.get(String(ing._id)) ?? 0;
      const dailyUsage = used / historyDays;
      const daysLeft = dailyUsage > 0 ? onHand / dailyUsage : Infinity;
      const supplier = ing.defaultSupplierId
        ? supplierMap.get(String(ing.defaultSupplierId))
        : undefined;
      if (onHand < ing.reorderThreshold) {
        actions.push({
          kind: "reorder",
          severity: "high",
          title: `Reorder ${ing.name}`,
          detail: `On hand ${onHand.toFixed(1)}${ing.unit} is below the ${ing.reorderThreshold}${ing.unit} threshold.${supplier ? ` Supplier: ${supplier}.` : ""}`,
        });
      } else if (Number.isFinite(daysLeft) && daysLeft <= 7) {
        actions.push({
          kind: "reorder",
          severity: "medium",
          title: `Order ${ing.name} this week`,
          detail: `At current pace (${dailyUsage.toFixed(1)}${ing.unit}/day) you'll run out in ~${daysLeft.toFixed(1)} day${daysLeft.toFixed(1) === "1.0" ? "" : "s"}.${supplier ? ` Supplier: ${supplier}.` : ""}`,
        });
      }
    }

    // ── Underperformers: zero-sale items in the last 14d ──
    const itemsCold = new Map<string, { menuItemId: Id<"menuItems">; name: string }>();
    const allMenu = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();
    for (const m of allMenu) itemsCold.set(String(m._id), { menuItemId: m._id, name: m.name });
    for (const o of orders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", o._id))
        .collect();
      for (const it of items) itemsCold.delete(String(it.menuItemId));
    }
    let coldCount = 0;
    for (const cold of itemsCold.values()) {
      if (coldCount >= 3) break;
      actions.push({
        kind: "promote",
        severity: "low",
        title: `${cold.name} hasn't sold in ${historyDays} days`,
        detail: "Consider featuring it on the register, running a promo, or removing it from the menu.",
      });
      coldCount++;
    }

    // ── Peak hour staffing hint ──
    const hourCounts = new Array(24).fill(0);
    for (const o of orders) hourCounts[new Date(o.completedAt as number).getHours()]++;
    let peakHour = 0;
    for (let h = 1; h < 24; h++) if (hourCounts[h] > hourCounts[peakHour]) peakHour = h;
    if (hourCounts[peakHour] > 0) {
      const ordersPerDay = hourCounts[peakHour] / historyDays;
      if (ordersPerDay >= 3) {
        actions.push({
          kind: "staffing",
          severity: "low",
          title: `Peak is ${peakHour}:00–${peakHour + 1}:00`,
          detail: `Averaging ${ordersPerDay.toFixed(1)} orders/day in that window over the last ${historyDays} days. Make sure two baristas overlap then.`,
        });
      }
    }

    actions.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 } as const;
      return order[a.severity] - order[b.severity];
    });

    return { generatedAt: now, actions };
  },
});
