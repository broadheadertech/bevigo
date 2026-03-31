import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, AuthContext } from "../lib/auth";
import { Id } from "../_generated/dataModel";

export const listOrderHistory = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
    status: v.optional(
      v.union(v.literal("completed"), v.literal("voided"))
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
    paymentType: v.optional(
      v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet"))
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locationIds = getLocationScope(session, args.locationId);
    const limit = args.limit ?? 50;

    const allOrders: Array<{
      _id: Id<"orders">;
      orderNumber: string;
      completedAt: number;
      total: number;
      paymentType: string;
      itemCount: number;
      status: string;
      baristaName: string;
      locationId: Id<"locations">;
    }> = [];

    for (const locId of locationIds) {
      // Query completed orders
      const completedOrders = args.status !== "voided"
        ? await ctx.db
            .query("orders")
            .withIndex("by_tenant_location_status", (q: any) =>
              q
                .eq("tenantId", session.tenantId)
                .eq("locationId", locId)
                .eq("status", "completed")
            )
            .collect()
        : [];

      // Query voided orders
      const voidedOrders = args.status !== "completed"
        ? await ctx.db
            .query("orders")
            .withIndex("by_tenant_location_status", (q: any) =>
              q
                .eq("tenantId", session.tenantId)
                .eq("locationId", locId)
                .eq("status", "voided")
            )
            .collect()
        : [];

      const combined = [...completedOrders, ...voidedOrders];

      for (const order of combined) {
        const orderTime = order.completedAt ?? order._creationTime;

        // Date range filter
        if (args.startDate != null && orderTime < args.startDate) continue;
        if (args.endDate != null && orderTime > args.endDate) continue;

        // Payment type filter
        if (args.paymentType && order.paymentType !== args.paymentType) continue;

        // Count items
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q: any) => q.eq("orderId", order._id))
          .collect();

        // Get barista name
        const user = await ctx.db.get(order.userId);
        const baristaName = user?.name ?? "Unknown";

        allOrders.push({
          _id: order._id,
          orderNumber: order.orderNumber ?? "",
          completedAt: orderTime,
          total: order.total,
          paymentType: order.paymentType ?? "cash",
          itemCount: items.length,
          status: order.status,
          baristaName,
          locationId: order.locationId,
        });
      }
    }

    // Sort by completedAt descending
    allOrders.sort(
      (a: { completedAt: number }, b: { completedAt: number }) =>
        b.completedAt - a.completedAt
    );

    return allOrders.slice(0, limit);
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
  if (session.role === "manager") {
    return session.locationIds;
  }
  return session.locationIds;
}
