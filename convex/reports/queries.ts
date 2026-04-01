import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess, AuthContext } from "../lib/auth";
import { Id } from "../_generated/dataModel";

export const dailySummary = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    // Determine which location IDs to query
    const locationIds = getLocationScope(session, args.locationId);

    // Query completed orders across all relevant locations
    let totalRevenue = 0;
    let transactionCount = 0;
    let taxCollected = 0;

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          totalRevenue += order.total;
          taxCollected += order.taxAmount;
          transactionCount += 1;
        }
      }
    }

    const averageOrderValue =
      transactionCount > 0 ? totalRevenue / transactionCount : 0;

    return {
      totalRevenue,
      transactionCount,
      averageOrderValue,
      taxCollected,
    };
  },
});

export const productMix = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    // Collect completed order IDs in range
    const orderIds: Id<"orders">[] = [];

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          orderIds.push(order._id);
        }
      }
    }

    // Aggregate order items by itemName
    const itemMap = new Map<
      string,
      { quantitySold: number; totalRevenue: number }
    >();

    for (const orderId of orderIds) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", orderId))
        .collect();

      for (const item of items) {
        const existing = itemMap.get(item.itemName);
        if (existing) {
          existing.quantitySold += item.quantity;
          existing.totalRevenue += item.subtotal;
        } else {
          itemMap.set(item.itemName, {
            quantitySold: item.quantity,
            totalRevenue: item.subtotal,
          });
        }
      }
    }

    // Calculate total revenue for percentage
    let grandTotal = 0;
    for (const entry of itemMap.values()) {
      grandTotal += entry.totalRevenue;
    }

    // Build result sorted by revenue descending
    const result: Array<{
      itemName: string;
      quantitySold: number;
      totalRevenue: number;
      percentageOfTotal: number;
    }> = [];

    for (const [itemName, data] of itemMap.entries()) {
      result.push({
        itemName,
        quantitySold: data.quantitySold,
        totalRevenue: data.totalRevenue,
        percentageOfTotal:
          grandTotal > 0 ? (data.totalRevenue / grandTotal) * 100 : 0,
      });
    }

    result.sort(
      (a: { totalRevenue: number }, b: { totalRevenue: number }) =>
        b.totalRevenue - a.totalRevenue
    );

    return result;
  },
});

export const hourlyVolume = query({
  args: {
    token: v.string(),
    date: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    // Calculate day boundaries from the given date timestamp
    const dayStart = args.date;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    // Initialize hourly buckets
    const hourly: Array<{
      hour: number;
      transactionCount: number;
      revenue: number;
    }> = [];
    for (let h = 0; h < 24; h++) {
      hourly.push({ hour: h, transactionCount: 0, revenue: 0 });
    }

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= dayStart &&
          order.completedAt < dayEnd
        ) {
          const hour = new Date(order.completedAt).getUTCHours();
          hourly[hour].transactionCount += 1;
          hourly[hour].revenue += order.total;
        }
      }
    }

    return hourly;
  },
});

export const costOfGoods = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const locationIds = getLocationScope(session, args.locationId);

    // Collect completed order IDs in range
    const orderIds: Id<"orders">[] = [];

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          orderIds.push(order._id);
        }
      }
    }

    // Aggregate order items by menuItemId
    const itemAgg = new Map<
      string,
      { menuItemId: Id<"menuItems">; itemName: string; qtySold: number; revenue: number }
    >();

    for (const orderId of orderIds) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", orderId))
        .collect();

      for (const item of items) {
        const key = item.menuItemId as string;
        const existing = itemAgg.get(key);
        if (existing) {
          existing.qtySold += item.quantity;
          existing.revenue += item.subtotal;
        } else {
          itemAgg.set(key, {
            menuItemId: item.menuItemId,
            itemName: item.itemName,
            qtySold: item.quantity,
            revenue: item.subtotal,
          });
        }
      }
    }

    // Build avg unit cost cache for ingredients from purchaseOrderItems
    const ingredientCostCache = new Map<string, number>();

    async function getAvgUnitCost(ingredientId: Id<"ingredients">): Promise<number> {
      const cached = ingredientCostCache.get(ingredientId as string);
      if (cached !== undefined) return cached;

      const poItems = await ctx.db
        .query("purchaseOrderItems")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .collect();

      let totalCost = 0;
      let totalQty = 0;
      for (const poi of poItems) {
        if (
          poi.ingredientId === ingredientId &&
          poi.unitCost != null &&
          poi.quantityReceived != null &&
          poi.quantityReceived > 0
        ) {
          totalCost += poi.unitCost * poi.quantityReceived;
          totalQty += poi.quantityReceived;
        }
      }
      const avg = totalQty > 0 ? totalCost / totalQty : 0;
      ingredientCostCache.set(ingredientId as string, avg);
      return avg;
    }

    // For each aggregated menu item, calculate COGS
    const result: Array<{
      itemName: string;
      qtySold: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
      margin: number;
    }> = [];

    for (const data of itemAgg.values()) {
      const recipes = await ctx.db
        .query("recipes")
        .withIndex("by_menu_item", (q) => q.eq("menuItemId", data.menuItemId))
        .collect();

      let ingredientCostPerUnit = 0;
      for (const recipe of recipes) {
        const avgCost = await getAvgUnitCost(recipe.ingredientId);
        ingredientCostPerUnit += recipe.quantityUsed * avgCost;
      }

      const totalCogs = ingredientCostPerUnit * data.qtySold;
      const grossProfit = data.revenue - totalCogs;
      const margin = data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0;

      result.push({
        itemName: data.itemName,
        qtySold: data.qtySold,
        revenue: data.revenue,
        cogs: Math.round(totalCogs),
        grossProfit: Math.round(grossProfit),
        margin: Math.round(margin * 10) / 10,
      });
    }

    result.sort(
      (a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue
    );

    return result;
  },
});

export const staffPerformance = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    // Aggregate completed orders by userId
    const staffAgg = new Map<
      string,
      { userId: Id<"users">; orderCount: number; totalRevenue: number }
    >();

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          const key = order.userId as string;
          const existing = staffAgg.get(key);
          if (existing) {
            existing.orderCount += 1;
            existing.totalRevenue += order.total;
          } else {
            staffAgg.set(key, {
              userId: order.userId,
              orderCount: 1,
              totalRevenue: order.total,
            });
          }
        }
      }
    }

    // Resolve user names + roles
    const result: Array<{
      userName: string;
      role: string;
      orderCount: number;
      totalRevenue: number;
      avgOrderValue: number;
    }> = [];

    for (const data of staffAgg.values()) {
      const user = await ctx.db.get(data.userId);
      const userName = user?.name ?? "Unknown";
      const role = user?.role ?? "unknown";
      const avgOrderValue =
        data.orderCount > 0 ? data.totalRevenue / data.orderCount : 0;

      result.push({
        userName,
        role,
        orderCount: data.orderCount,
        totalRevenue: data.totalRevenue,
        avgOrderValue: Math.round(avgOrderValue),
      });
    }

    result.sort(
      (a: { totalRevenue: number }, b: { totalRevenue: number }) =>
        b.totalRevenue - a.totalRevenue
    );

    return result;
  },
});

export const inventoryValuation = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const locationIds = getLocationScope(session, args.locationId);

    // Get all ingredient stocks for the tenant
    const allStocks = await ctx.db
      .query("ingredientStock")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    // Filter by relevant locations
    const locationSet = new Set(locationIds.map((id: Id<"locations">) => id as string));
    const relevantStocks = allStocks.filter(
      (s: (typeof allStocks)[number]) => locationSet.has(s.locationId as string)
    );

    // Get all purchase order items for avg cost calculation
    const allPOItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    // Build avg unit cost per ingredient
    const costMap = new Map<string, { totalCost: number; totalQty: number }>();
    for (const poi of allPOItems) {
      if (poi.unitCost != null && poi.quantityReceived != null && poi.quantityReceived > 0) {
        const key = poi.ingredientId as string;
        const existing = costMap.get(key);
        if (existing) {
          existing.totalCost += poi.unitCost * poi.quantityReceived;
          existing.totalQty += poi.quantityReceived;
        } else {
          costMap.set(key, {
            totalCost: poi.unitCost * poi.quantityReceived,
            totalQty: poi.quantityReceived,
          });
        }
      }
    }

    // Aggregate stock by ingredient (sum across locations if no specific location)
    const ingredientAgg = new Map<
      string,
      { ingredientId: Id<"ingredients">; stock: number }
    >();

    for (const s of relevantStocks) {
      const key = s.ingredientId as string;
      const existing = ingredientAgg.get(key);
      if (existing) {
        existing.stock += s.quantity;
      } else {
        ingredientAgg.set(key, {
          ingredientId: s.ingredientId,
          stock: s.quantity,
        });
      }
    }

    const items: Array<{
      ingredientName: string;
      unit: string;
      category: string;
      stock: number;
      avgUnitCost: number;
      totalValue: number;
    }> = [];

    let grandTotal = 0;

    for (const data of ingredientAgg.values()) {
      if (data.stock <= 0) continue;

      const ingredient = await ctx.db.get(data.ingredientId);
      if (!ingredient) continue;

      const costData = costMap.get(data.ingredientId as string);
      const avgUnitCost =
        costData && costData.totalQty > 0
          ? costData.totalCost / costData.totalQty
          : 0;

      const totalValue = Math.round(data.stock * avgUnitCost);
      grandTotal += totalValue;

      items.push({
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        category: ingredient.category ?? "Uncategorized",
        stock: data.stock,
        avgUnitCost: Math.round(avgUnitCost),
        totalValue,
      });
    }

    items.sort(
      (a: { totalValue: number }, b: { totalValue: number }) =>
        b.totalValue - a.totalValue
    );

    return { items, grandTotal };
  },
});

/**
 * Determines which locations to scope the query to based on auth context.
 */
function getLocationScope(
  session: AuthContext,
  locationId?: Id<"locations">
): Id<"locations">[] {
  if (locationId) {
    // If a specific location is requested, verify access for managers
    if (session.role !== "owner") {
      requireLocationAccess(session, locationId);
    }
    return [locationId];
  }

  // For managers with no specific location, scope to their assigned locations
  if (session.role === "manager") {
    return session.locationIds;
  }

  // Owners with no specific location: return all their locations
  // (They will see data across all locations via tenant-level queries)
  return session.locationIds;
}

// ---------------------------------------------------------------------------
// Order Analytics queries
// ---------------------------------------------------------------------------

export const salesByPaymentType = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    const paymentMap = new Map<
      string,
      { orderCount: number; totalRevenue: number }
    >();

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          const pt = order.paymentType ?? "cash";
          const existing = paymentMap.get(pt);
          if (existing) {
            existing.orderCount += 1;
            existing.totalRevenue += order.total;
          } else {
            paymentMap.set(pt, { orderCount: 1, totalRevenue: order.total });
          }
        }
      }
    }

    let grandTotal = 0;
    for (const entry of paymentMap.values()) {
      grandTotal += entry.totalRevenue;
    }

    const result: Array<{
      paymentType: string;
      orderCount: number;
      totalRevenue: number;
      percentage: number;
    }> = [];

    for (const [paymentType, data] of paymentMap.entries()) {
      result.push({
        paymentType,
        orderCount: data.orderCount,
        totalRevenue: data.totalRevenue,
        percentage: grandTotal > 0 ? (data.totalRevenue / grandTotal) * 100 : 0,
      });
    }

    result.sort(
      (a: { totalRevenue: number }, b: { totalRevenue: number }) =>
        b.totalRevenue - a.totalRevenue
    );

    return result;
  },
});

export const salesByTimePeriod = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    const periods: Array<{
      period: string;
      label: string;
      startHour: number;
      endHour: number;
      orderCount: number;
      totalRevenue: number;
    }> = [
      { period: "morning", label: "Morning (6-11)", startHour: 6, endHour: 11, orderCount: 0, totalRevenue: 0 },
      { period: "lunch", label: "Lunch (11-14)", startHour: 11, endHour: 14, orderCount: 0, totalRevenue: 0 },
      { period: "afternoon", label: "Afternoon (14-17)", startHour: 14, endHour: 17, orderCount: 0, totalRevenue: 0 },
      { period: "evening", label: "Evening (17-22)", startHour: 17, endHour: 22, orderCount: 0, totalRevenue: 0 },
      { period: "night", label: "Night (22-6)", startHour: 22, endHour: 6, orderCount: 0, totalRevenue: 0 },
    ];

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          const hour = new Date(order.completedAt).getUTCHours();
          for (const p of periods) {
            if (p.period === "night") {
              if (hour >= 22 || hour < 6) {
                p.orderCount += 1;
                p.totalRevenue += order.total;
                break;
              }
            } else {
              if (hour >= p.startHour && hour < p.endHour) {
                p.orderCount += 1;
                p.totalRevenue += order.total;
                break;
              }
            }
          }
        }
      }
    }

    return periods.map(
      (p: { period: string; label: string; orderCount: number; totalRevenue: number }) => ({
        period: p.period,
        label: p.label,
        orderCount: p.orderCount,
        totalRevenue: p.totalRevenue,
        avgOrderValue: p.orderCount > 0 ? Math.round(p.totalRevenue / p.orderCount) : 0,
      })
    );
  },
});

export const salesByStaff = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    const staffAgg = new Map<
      string,
      { userId: Id<"users">; orderCount: number; totalRevenue: number; voidCount: number }
    >();

    for (const locId of locationIds) {
      // Completed orders
      const completedOrders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of completedOrders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          const key = order.userId as string;
          const existing = staffAgg.get(key);
          if (existing) {
            existing.orderCount += 1;
            existing.totalRevenue += order.total;
          } else {
            staffAgg.set(key, {
              userId: order.userId,
              orderCount: 1,
              totalRevenue: order.total,
              voidCount: 0,
            });
          }
        }
      }

      // Voided orders
      const voidedOrders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "voided")
        )
        .collect();

      for (const order of voidedOrders) {
        if (
          order.updatedAt >= args.startDate &&
          order.updatedAt <= args.endDate
        ) {
          const key = order.userId as string;
          const existing = staffAgg.get(key);
          if (existing) {
            existing.voidCount += 1;
          } else {
            staffAgg.set(key, {
              userId: order.userId,
              orderCount: 0,
              totalRevenue: 0,
              voidCount: 1,
            });
          }
        }
      }
    }

    const result: Array<{
      userName: string;
      role: string;
      orderCount: number;
      totalRevenue: number;
      avgOrderValue: number;
      voidCount: number;
    }> = [];

    for (const data of staffAgg.values()) {
      const user = await ctx.db.get(data.userId);
      const userName = user?.name ?? "Unknown";
      const role = user?.role ?? "unknown";
      const avgOrderValue =
        data.orderCount > 0 ? Math.round(data.totalRevenue / data.orderCount) : 0;

      result.push({
        userName,
        role,
        orderCount: data.orderCount,
        totalRevenue: data.totalRevenue,
        avgOrderValue,
        voidCount: data.voidCount,
      });
    }

    result.sort(
      (a: { totalRevenue: number }, b: { totalRevenue: number }) =>
        b.totalRevenue - a.totalRevenue
    );

    return result;
  },
});

export const salesByTable = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const locationIds = getLocationScope(session, args.locationId);

    const tableMap = new Map<
      string,
      { orderCount: number; totalRevenue: number }
    >();

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          const tableName = order.tableName ?? "Takeout/Counter";
          const existing = tableMap.get(tableName);
          if (existing) {
            existing.orderCount += 1;
            existing.totalRevenue += order.total;
          } else {
            tableMap.set(tableName, { orderCount: 1, totalRevenue: order.total });
          }
        }
      }
    }

    const result: Array<{
      tableName: string;
      orderCount: number;
      totalRevenue: number;
      avgOrderValue: number;
    }> = [];

    for (const [tableName, data] of tableMap.entries()) {
      result.push({
        tableName,
        orderCount: data.orderCount,
        totalRevenue: data.totalRevenue,
        avgOrderValue: data.orderCount > 0 ? Math.round(data.totalRevenue / data.orderCount) : 0,
      });
    }

    result.sort(
      (a: { totalRevenue: number }, b: { totalRevenue: number }) =>
        b.totalRevenue - a.totalRevenue
    );

    return result;
  },
});

export const peakDayAnalysis = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days: Array<{ orderCount: number; totalRevenue: number }> = [];
    for (let i = 0; i < 7; i++) {
      days.push({ orderCount: 0, totalRevenue: 0 });
    }

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          const dayOfWeek = new Date(order.completedAt).getUTCDay();
          days[dayOfWeek].orderCount += 1;
          days[dayOfWeek].totalRevenue += order.total;
        }
      }
    }

    return days.map(
      (d: { orderCount: number; totalRevenue: number }, i: number) => ({
        dayOfWeek: i,
        dayName: dayNames[i],
        orderCount: d.orderCount,
        totalRevenue: d.totalRevenue,
        avgOrderValue: d.orderCount > 0 ? Math.round(d.totalRevenue / d.orderCount) : 0,
      })
    );
  },
});

export const voidReport = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const locationIds = getLocationScope(session, args.locationId);

    let totalCompleted = 0;
    const voids: Array<{
      orderNumber: string;
      voidedAt: number;
      voidReason: string;
      voidedByName: string;
      originalTotal: number;
    }> = [];

    for (const locId of locationIds) {
      // Count completed orders
      const completedOrders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of completedOrders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate
        ) {
          totalCompleted += 1;
        }
      }

      // Voided orders
      const voidedOrders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "voided")
        )
        .collect();

      for (const order of voidedOrders) {
        if (
          order.updatedAt >= args.startDate &&
          order.updatedAt <= args.endDate
        ) {
          let voidedByName = "Unknown";
          if (order.voidedBy) {
            const voidUser = await ctx.db.get(order.voidedBy);
            voidedByName = voidUser?.name ?? "Unknown";
          }
          voids.push({
            orderNumber: order.orderNumber ?? "-",
            voidedAt: order.updatedAt,
            voidReason: order.voidReason ?? "No reason provided",
            voidedByName,
            originalTotal: order.total,
          });
        }
      }
    }

    let totalVoided = 0;
    for (const v of voids) {
      totalVoided += v.originalTotal;
    }

    const totalOrders = totalCompleted + voids.length;
    const voidRate = totalOrders > 0 ? (voids.length / totalOrders) * 100 : 0;

    return {
      totalVoided,
      voidCount: voids.length,
      voidRate: Math.round(voidRate * 10) / 10,
      voids,
    };
  },
});

export const customerRepeatRate = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    let totalOrdersWithCustomer = 0;
    const customerAgg = new Map<
      string,
      { customerId: Id<"customers">; orderCount: number; totalSpent: number }
    >();

    for (const locId of locationIds) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of orders) {
        if (
          order.completedAt != null &&
          order.completedAt >= args.startDate &&
          order.completedAt <= args.endDate &&
          order.customerId
        ) {
          totalOrdersWithCustomer += 1;
          const key = order.customerId as string;
          const existing = customerAgg.get(key);
          if (existing) {
            existing.orderCount += 1;
            existing.totalSpent += order.total;
          } else {
            customerAgg.set(key, {
              customerId: order.customerId,
              orderCount: 1,
              totalSpent: order.total,
            });
          }
        }
      }
    }

    const uniqueCustomers = customerAgg.size;
    const repeatRate =
      uniqueCustomers > 0
        ? Math.round(
            ((totalOrdersWithCustomer - uniqueCustomers) / totalOrdersWithCustomer) * 100 * 10
          ) / 10
        : 0;

    // Top customers
    const topCustomers: Array<{
      customerName: string;
      orderCount: number;
      totalSpent: number;
    }> = [];

    const sorted = Array.from(customerAgg.values()).sort(
      (a: { totalSpent: number }, b: { totalSpent: number }) =>
        b.totalSpent - a.totalSpent
    );

    for (const data of sorted.slice(0, 10)) {
      const customer = await ctx.db.get(data.customerId);
      topCustomers.push({
        customerName: customer?.name ?? "Unknown",
        orderCount: data.orderCount,
        totalSpent: data.totalSpent,
      });
    }

    return {
      totalOrdersWithCustomer,
      uniqueCustomers,
      repeatRate,
      topCustomers,
    };
  },
});
