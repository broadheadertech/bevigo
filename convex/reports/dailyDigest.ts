import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Daily Digest — one-shot end-of-day report combining sales, products,
 * tender mix, ingredient consumption, and ingredient open/close stock.
 *
 * Closing stock is the live `ingredientStock` row right now. Opening
 * stock is reconstructed by walking backwards through today's deductions
 * (recipe-derived consumption from completed orders) and explicit
 * `stockAdjustments`. Result is approximate — receiving / counts done
 * mid-day still ladder onto the same number, but it's accurate enough
 * for an EOD reconciliation.
 */
export const dailyDigest = query({
  args: {
    token: v.string(),
    /** Midnight epoch ms for the day to summarize. Window = [date, date+24h). */
    date: v.number(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    requireLocationAccess(session, args.locationId);

    const dayStart = args.date;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

    // ── Orders in window (completed + voided + refunded) ──
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", args.locationId)
      )
      .collect();
    const inWindow = allOrders.filter(
      (o: Doc<"orders">) =>
        o.completedAt !== undefined &&
        o.completedAt >= dayStart &&
        o.completedAt <= dayEnd
    );

    let revenue = 0;
    let net = 0;
    let tax = 0;
    let orderCount = 0;
    let voidCount = 0;
    let refundCount = 0;
    let refundAmount = 0;
    let cash = 0;
    let card = 0;
    let ewallet = 0;
    const hourly = new Array(24).fill(0).map(() => ({ orders: 0, revenue: 0 }));

    for (const o of inWindow) {
      const h = new Date(o.completedAt as number).getHours();
      hourly[h].orders++;
      hourly[h].revenue += o.total;

      if (o.status === "voided") {
        voidCount++;
        continue;
      }
      if (o.refundedAt && o.refundedAt >= dayStart && o.refundedAt <= dayEnd) {
        refundCount++;
        refundAmount += o.refundAmount ?? o.total;
        continue;
      }
      orderCount++;
      revenue += o.total;
      tax += o.taxAmount;
      net += o.total - o.taxAmount;

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
    let peakHour = 0;
    for (let h = 1; h < 24; h++) {
      if (hourly[h].orders > hourly[peakHour].orders) peakHour = h;
    }

    // ── Product mix + total units sold ──
    const itemTotals = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    let totalUnits = 0;
    const consumption = new Map<string, number>(); // ingredientId -> qty consumed today

    for (const o of inWindow) {
      // Skip voided and refunded for product mix and consumption
      if (o.status === "voided") continue;
      if (o.refundedAt && o.refundedAt >= dayStart && o.refundedAt <= dayEnd) continue;

      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", o._id))
        .collect();
      for (const it of items) {
        totalUnits += it.quantity;
        const cur = itemTotals.get(it.itemName) ?? {
          name: it.itemName,
          qty: 0,
          revenue: 0,
        };
        cur.qty += it.quantity;
        cur.revenue += it.subtotal;
        itemTotals.set(it.itemName, cur);

        // Sum recipe-driven ingredient consumption (base recipe rows only —
        // variant/modifier-recipe deltas are intentionally omitted to keep
        // this report at a stable approximation of usage).
        const recipes = await ctx.db
          .query("recipes")
          .withIndex("by_menu_item", (q) => q.eq("menuItemId", it.menuItemId))
          .collect();
        for (const r of recipes) {
          if (r.variantKey) continue;
          const k = String(r.ingredientId);
          consumption.set(
            k,
            (consumption.get(k) ?? 0) + r.quantityUsed * it.quantity
          );
        }
      }
    }
    const productMix = [...itemTotals.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .map((p) => ({
        name: p.name,
        qty: p.qty,
        revenue: p.revenue,
        percentageOfRevenue: revenue > 0 ? (p.revenue / revenue) * 100 : 0,
      }));

    // ── Ingredient open/close stock ──
    // Closing = current on-hand. Adjustments today = sum of stockAdjustments
    // rows whose createdAt is in the window. Opening = closing + consumption
    // - adjustments (signed: positive adjustment increases stock, so subtract).
    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const stockRows = await ctx.db
      .query("ingredientStock")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();
    const onHandMap = new Map(stockRows.map((s) => [String(s.ingredientId), s.quantity]));

    const adjustmentsToday = await ctx.db
      .query("stockAdjustments")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();
    const adjMap = new Map<string, number>();
    for (const a of adjustmentsToday) {
      if (a.createdAt < dayStart || a.createdAt > dayEnd) continue;
      const k = String(a.ingredientId);
      adjMap.set(k, (adjMap.get(k) ?? 0) + a.quantity);
    }

    type IngredientRow = {
      ingredientId: Id<"ingredients">;
      name: string;
      unit: string;
      category: string | null;
      openingStock: number;
      consumed: number;
      adjustment: number;
      closingStock: number;
      reorderThreshold: number;
      belowThreshold: boolean;
      isOut: boolean;
    };
    const ingredientRows: IngredientRow[] = ingredients
      .filter((ing) => ing.status === "active")
      .map((ing) => {
        const k = String(ing._id);
        const closing = onHandMap.get(k) ?? 0;
        const consumed = consumption.get(k) ?? 0;
        const adjustment = adjMap.get(k) ?? 0;
        // closing = opening + adjustment - consumed
        // → opening = closing - adjustment + consumed
        const opening = closing - adjustment + consumed;
        return {
          ingredientId: ing._id,
          name: ing.name,
          unit: ing.unit,
          category: ing.category ?? null,
          openingStock: opening,
          consumed,
          adjustment,
          closingStock: closing,
          reorderThreshold: ing.reorderThreshold,
          belowThreshold: closing < ing.reorderThreshold,
          isOut: closing <= 0,
        };
      })
      .sort((a, b) => {
        // Surface anything consumed today first, then by ingredient name.
        if (a.consumed > 0 && b.consumed === 0) return -1;
        if (a.consumed === 0 && b.consumed > 0) return 1;
        return a.name.localeCompare(b.name);
      });

    // ── Shifts that overlapped today ──
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", args.locationId)
      )
      .collect();
    const shiftsToday = shifts.filter((s: Doc<"shifts">) => {
      const end = s.endedAt ?? Date.now();
      return end >= dayStart && s.startedAt <= dayEnd;
    });

    // ── Location label ──
    const location = await ctx.db.get(args.locationId);

    return {
      date: dayStart,
      locationName: location?.name ?? "Unknown",
      generatedAt: Date.now(),
      sales: {
        revenue,
        net,
        tax,
        avgTicket: orderCount > 0 ? revenue / orderCount : 0,
        orderCount,
        voidCount,
        refundCount,
        refundAmount,
      },
      tender: { cash, card, ewallet },
      products: {
        totalUnits,
        distinctItems: itemTotals.size,
        mix: productMix,
      },
      ingredients: {
        consumedCount: ingredientRows.filter((r) => r.consumed > 0).length,
        belowThresholdCount: ingredientRows.filter((r) => r.belowThreshold).length,
        outCount: ingredientRows.filter((r) => r.isOut).length,
        rows: ingredientRows,
      },
      operations: {
        peakHour,
        peakHourOrders: hourly[peakHour].orders,
        shiftCount: shiftsToday.length,
      },
    };
  },
});
