import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, AuthContext } from "../lib/auth";
import { Id } from "../_generated/dataModel";

export const getDashboardMetrics = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);

    // Calculate today's midnight (UTC)
    const now = Date.now();
    const todayDate = new Date(now);
    const todayStart = Date.UTC(
      todayDate.getUTCFullYear(),
      todayDate.getUTCMonth(),
      todayDate.getUTCDate()
    );

    let totalRevenue = 0;
    let orderCount = 0;
    let taxCollected = 0;
    let pendingOrders = 0;

    for (const locId of locationIds) {
      // Completed orders for today
      const completed = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q: any) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();

      for (const order of completed) {
        if (
          order.completedAt != null &&
          order.completedAt >= todayStart &&
          order.completedAt <= now
        ) {
          totalRevenue += order.total;
          taxCollected += order.taxAmount;
          orderCount += 1;
        }
      }

      // Draft (pending) orders
      const drafts = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q: any) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "draft")
        )
        .collect();

      pendingOrders += drafts.length;
    }

    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Low stock count
    let lowStockCount = 0;

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant_status", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    for (const ingredient of ingredients) {
      for (const locId of locationIds) {
        const stock = await ctx.db
          .query("ingredientStock")
          .withIndex("by_ingredient_location", (q: any) =>
            q.eq("ingredientId", ingredient._id).eq("locationId", locId)
          )
          .unique();

        const quantity = stock?.quantity ?? 0;
        if (quantity < ingredient.reorderThreshold) {
          lowStockCount += 1;
          break; // Count ingredient only once even if low at multiple locations
        }
      }
    }

    return {
      totalRevenue,
      orderCount,
      averageOrderValue,
      taxCollected,
      pendingOrders,
      lowStockCount,
    };
  },
});

function getLocationScope(
  session: AuthContext,
  locationId?: Id<"locations">
): Id<"locations">[] {
  if (locationId) {
    if (session.role !== "owner" && !session.locationIds.includes(locationId)) {
      throw new Error("Forbidden: no access to this location");
    }
    return [locationId];
  }
  return session.locationIds;
}
