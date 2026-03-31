import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { Doc } from "../_generated/dataModel";

export const listPurchaseOrders = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("ordered"),
        v.literal("received"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    let orders: Doc<"purchaseOrders">[];

    if (args.locationId) {
      orders = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_tenant_location", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("locationId", args.locationId!)
        )
        .collect();
    } else if (args.status) {
      orders = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_tenant_status", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("status", args.status!)
        )
        .collect();
    } else {
      orders = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_tenant", (q: any) =>
          q.eq("tenantId", session.tenantId)
        )
        .collect();
    }

    // Apply status filter if locationId was used for the primary filter
    if (args.locationId && args.status) {
      orders = orders.filter(
        (o: Doc<"purchaseOrders">) => o.status === args.status
      );
    }

    const results = await Promise.all(
      orders.map(async (order: Doc<"purchaseOrders">) => {
        const items = await ctx.db
          .query("purchaseOrderItems")
          .withIndex("by_purchase_order", (q: any) =>
            q.eq("purchaseOrderId", order._id)
          )
          .collect();

        const location = await ctx.db.get(order.locationId);
        const user = await ctx.db.get(order.userId);

        return {
          ...order,
          locationName: location?.name ?? "Unknown",
          userName: user?.name ?? "Unknown",
          itemCount: items.length,
        };
      })
    );

    // Sort newest first
    results.sort(
      (a: { _creationTime: number }, b: { _creationTime: number }) =>
        b._creationTime - a._creationTime
    );

    return results;
  },
});

export const getPurchaseOrder = query({
  args: {
    token: v.string(),
    purchaseOrderId: v.id("purchaseOrders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.purchaseOrderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Purchase order not found");
    }

    const items = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_purchase_order", (q: any) =>
        q.eq("purchaseOrderId", args.purchaseOrderId)
      )
      .collect();

    const itemsWithNames = await Promise.all(
      items.map(async (item: Doc<"purchaseOrderItems">) => {
        const ingredient = await ctx.db.get(item.ingredientId);
        return {
          ...item,
          ingredientName: ingredient?.name ?? "Unknown",
          ingredientUnit: ingredient?.unit ?? "",
        };
      })
    );

    const location = await ctx.db.get(order.locationId);
    const user = await ctx.db.get(order.userId);

    return {
      ...order,
      locationName: location?.name ?? "Unknown",
      userName: user?.name ?? "Unknown",
      items: itemsWithNames,
    };
  },
});
