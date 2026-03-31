import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const getCurrentDraft = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Find the most recent draft order for this user at this location
    const drafts = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location_status", (q) =>
        q
          .eq("tenantId", session.tenantId)
          .eq("locationId", args.locationId)
          .eq("status", "draft")
      )
      .collect();

    // Filter to current user's drafts and get most recent
    const userDrafts = drafts.filter((o) => o.userId === session.userId);
    if (userDrafts.length === 0) return null;

    const order = userDrafts.sort(
      (a, b) => b._creationTime - a._creationTime
    )[0];

    // Get order items
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    // Get modifiers for each item
    const itemsWithModifiers = await Promise.all(
      items.map(async (item) => {
        const modifiers = await ctx.db
          .query("orderItemModifiers")
          .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
          .collect();
        return { ...item, modifiers };
      })
    );

    return { ...order, items: itemsWithModifiers };
  },
});

export const getOrderWithItems = query({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) return null;

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const itemsWithModifiers = await Promise.all(
      items.map(async (item) => {
        const modifiers = await ctx.db
          .query("orderItemModifiers")
          .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
          .collect();
        return { ...item, modifiers };
      })
    );

    return { ...order, items: itemsWithModifiers };
  },
});

export const getReceipt = query({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) return null;

    // Get order items with modifiers
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const itemsWithModifiers = await Promise.all(
      items.map(async (item: (typeof items)[number]) => {
        const modifiers = await ctx.db
          .query("orderItemModifiers")
          .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
          .collect();
        return {
          name: item.itemName,
          quantity: item.quantity,
          subtotal: item.subtotal,
          modifiers: modifiers.map((mod: (typeof modifiers)[number]) => ({
            name: mod.modifierName,
            priceAdj: mod.priceAdjustment,
          })),
        };
      })
    );

    // Get location info
    const location = await ctx.db.get(order.locationId);
    const locationName = location?.name ?? "Unknown Location";
    const locationAddress = location?.address ?? "";

    // Get barista (user) name
    const user = await ctx.db.get(order.userId);
    const baristaName = user?.name ?? "Unknown";

    return {
      orderNumber: order.orderNumber ?? "",
      completedAt: order.completedAt ?? order._creationTime,
      locationName,
      locationAddress,
      baristaName,
      paymentType: order.paymentType ?? "cash",
      items: itemsWithModifiers,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      taxRate: order.taxRate,
      taxLabel: order.taxLabel,
      total: order.total,
    };
  },
});

export const listPending = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const drafts = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location_status", (q) =>
        q
          .eq("tenantId", session.tenantId)
          .eq("locationId", args.locationId)
          .eq("status", "draft")
      )
      .collect();

    // Get item counts for each order
    const ordersWithCounts = await Promise.all(
      drafts.map(async (order) => {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        return {
          _id: order._id,
          userId: order.userId,
          subtotal: order.subtotal,
          itemCount: items.length,
          _creationTime: order._creationTime,
        };
      })
    );

    return ordersWithCounts;
  },
});
