import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { addStampInternal } from "../customers/mutations";

export const createDraftOrder = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Validate location belongs to tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const orderId = await ctx.db.insert("orders", {
      tenantId: session.tenantId,
      locationId: args.locationId,
      userId: session.userId,
      status: "draft",
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      taxRate: location.taxRate,
      taxLabel: location.taxLabel,
      updatedAt: Date.now(),
    });

    return orderId;
  },
});

export const addItemToOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    menuItemId: v.id("menuItems"),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only add items to draft orders");
    }

    // Get menu item
    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem || menuItem.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Check for location price override
    const override = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", args.menuItemId).eq("locationId", order.locationId)
      )
      .unique();

    const effectivePrice = override?.price ?? menuItem.basePrice;
    const qty = args.quantity ?? 1;

    // Create order item with denormalized snapshot
    const orderItemId = await ctx.db.insert("orderItems", {
      orderId: args.orderId,
      menuItemId: args.menuItemId,
      tenantId: session.tenantId,
      itemName: menuItem.name,
      basePrice: effectivePrice,
      quantity: qty,
      subtotal: effectivePrice * qty,
    });

    // Recalculate order totals
    await recalculateOrderTotals(ctx, args.orderId);

    return orderItemId;
  },
});

export const addItemWithModifiers = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    menuItemId: v.id("menuItems"),
    modifiers: v.array(
      v.object({
        modifierName: v.string(),
        priceAdjustment: v.number(),
      })
    ),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only add items to draft orders");
    }

    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem || menuItem.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Check for location price override
    const override = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", args.menuItemId).eq("locationId", order.locationId)
      )
      .unique();

    const effectivePrice = override?.price ?? menuItem.basePrice;
    const qty = args.quantity ?? 1;

    // Calculate modifier adjustments
    const modifierTotal = args.modifiers.reduce(
      (sum, m) => sum + m.priceAdjustment,
      0
    );
    const itemTotal = (effectivePrice + modifierTotal) * qty;

    // Create order item
    const orderItemId = await ctx.db.insert("orderItems", {
      orderId: args.orderId,
      menuItemId: args.menuItemId,
      tenantId: session.tenantId,
      itemName: menuItem.name,
      basePrice: effectivePrice,
      quantity: qty,
      subtotal: itemTotal,
    });

    // Create modifier records
    for (const mod of args.modifiers) {
      await ctx.db.insert("orderItemModifiers", {
        orderItemId,
        tenantId: session.tenantId,
        modifierName: mod.modifierName,
        priceAdjustment: mod.priceAdjustment,
      });
    }

    // Recalculate order totals
    await recalculateOrderTotals(ctx, args.orderId);

    return orderItemId;
  },
});

export const removeItemFromOrder = mutation({
  args: {
    token: v.string(),
    orderItemId: v.id("orderItems"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const orderItem = await ctx.db.get(args.orderItemId);
    if (!orderItem || orderItem.tenantId !== session.tenantId) {
      throw new Error("Order item not found");
    }

    const order = await ctx.db.get(orderItem.orderId);
    if (!order || order.status !== "draft") {
      throw new Error("Can only remove items from draft orders");
    }

    // Delete modifiers first
    const modifiers = await ctx.db
      .query("orderItemModifiers")
      .withIndex("by_order_item", (q) => q.eq("orderItemId", args.orderItemId))
      .collect();
    for (const mod of modifiers) {
      await ctx.db.delete(mod._id);
    }

    // Delete the order item
    await ctx.db.delete(args.orderItemId);

    // Check if order has any remaining items
    const remainingItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderItem.orderId))
      .collect();

    if (remainingItems.length === 0) {
      // Abandon the order
      await ctx.db.patch(orderItem.orderId, {
        status: "abandoned",
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        updatedAt: Date.now(),
      });
    } else {
      await recalculateOrderTotals(ctx, orderItem.orderId);
    }

    return orderItem.orderId;
  },
});

export const updateItemModifiers = mutation({
  args: {
    token: v.string(),
    orderItemId: v.id("orderItems"),
    modifiers: v.array(
      v.object({
        modifierName: v.string(),
        priceAdjustment: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const orderItem = await ctx.db.get(args.orderItemId);
    if (!orderItem || orderItem.tenantId !== session.tenantId) {
      throw new Error("Order item not found");
    }

    const order = await ctx.db.get(orderItem.orderId);
    if (!order || order.status !== "draft") {
      throw new Error("Can only modify items on draft orders");
    }

    // Delete existing modifiers for this item
    const existingModifiers = await ctx.db
      .query("orderItemModifiers")
      .withIndex("by_order_item", (q) => q.eq("orderItemId", args.orderItemId))
      .collect();
    for (const mod of existingModifiers) {
      await ctx.db.delete(mod._id);
    }

    // Insert new modifiers
    for (const mod of args.modifiers) {
      await ctx.db.insert("orderItemModifiers", {
        orderItemId: args.orderItemId,
        tenantId: session.tenantId,
        modifierName: mod.modifierName,
        priceAdjustment: mod.priceAdjustment,
      });
    }

    // Recalculate item subtotal
    const modifierTotal = args.modifiers.reduce(
      (sum, m) => sum + m.priceAdjustment,
      0
    );
    const itemSubtotal =
      (orderItem.basePrice + modifierTotal) * orderItem.quantity;
    await ctx.db.patch(args.orderItemId, { subtotal: itemSubtotal });

    // Recalculate order totals
    await recalculateOrderTotals(ctx, orderItem.orderId);

    return args.orderItemId;
  },
});

export const completeOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    paymentType: v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only complete draft orders");
    }

    // Validate order has at least one item
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    if (items.length === 0) {
      throw new Error("Cannot complete an order with no items");
    }

    // Read location for latest tax info
    const location = await ctx.db.get(order.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    // Recalculate totals from items
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = Math.round(subtotal * (location.taxRate / 10000));
    const total = subtotal + taxAmount;

    // Generate order number: ORD-{locationSlug}-{timestamp}
    const orderNumber = `ORD-${location.slug.toUpperCase()}-${Date.now()}`;

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      status: "completed",
      paymentType: args.paymentType,
      orderNumber,
      subtotal,
      taxAmount,
      taxRate: location.taxRate,
      taxLabel: location.taxLabel,
      total,
      completedAt: now,
      updatedAt: now,
    });

    // Auto-deduct ingredient stock (Story 8.3)
    await deductStockForOrder(ctx, items, order.locationId, session.tenantId);

    // Customer engagement: update stats and add loyalty stamp (Story 11)
    if (order.customerId) {
      const customer = await ctx.db.get(order.customerId);
      if (customer && customer.tenantId === session.tenantId) {
        await ctx.db.patch(order.customerId, {
          visitCount: customer.visitCount + 1,
          totalSpent: customer.totalSpent + total,
          lastVisitAt: now,
          updatedAt: now,
        });
        await addStampInternal(ctx, order.customerId, session.tenantId);
      }
    }

    // Increment subscription monthly order count (Story 14.2)
    const subscription = await ctx.db
      .query("tenantSubscriptions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", session.tenantId))
      .unique();
    if (subscription) {
      await ctx.db.patch(subscription._id, {
        monthlyOrderCount: subscription.monthlyOrderCount + 1,
        updatedAt: now,
      });
    }

    // Audit log
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "order.completed",
      "orders",
      args.orderId,
      { orderNumber, paymentType: args.paymentType, total },
    );

    return { orderId: args.orderId, orderNumber, total };
  },
});

export const linkCustomerToOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only link customer to draft orders");
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    await ctx.db.patch(args.orderId, {
      customerId: args.customerId,
      updatedAt: Date.now(),
    });

    return args.orderId;
  },
});

export const unlinkCustomerFromOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only unlink customer from draft orders");
    }

    await ctx.db.patch(args.orderId, {
      customerId: undefined,
      updatedAt: Date.now(),
    });

    return args.orderId;
  },
});

// Internal helper — not exported as a Convex function
async function recalculateOrderTotals(ctx: MutationCtx, orderId: Id<"orders">) {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  const order = await ctx.db.get(orderId);
  if (!order) return;

  const taxAmount = Math.round(subtotal * (order.taxRate / 10000)); // taxRate in basis points
  const total = subtotal + taxAmount;

  await ctx.db.patch(order._id, {
    subtotal,
    taxAmount,
    total,
    updatedAt: Date.now(),
  });
}

/**
 * Deduct ingredient stock for all items in a completed order.
 * For each order item, looks up recipes to find which ingredients are consumed,
 * then decrements ingredientStock accordingly. If no stock record exists,
 * creates one with negative quantity (corrected on next stock take).
 */
async function deductStockForOrder(
  ctx: MutationCtx,
  orderItems: Doc<"orderItems">[],
  locationId: Id<"locations">,
  tenantId: Id<"tenants">,
) {
  for (const item of orderItems) {
    // Find all recipe rows for this menu item
    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_menu_item", (q: any) => q.eq("menuItemId", item.menuItemId))
      .collect();

    for (const recipe of recipes) {
      const deductionAmount = recipe.quantityUsed * item.quantity;

      // Look up existing stock record for this ingredient at this location
      const stockRecord = await ctx.db
        .query("ingredientStock")
        .withIndex("by_ingredient_location", (q: any) =>
          q.eq("ingredientId", recipe.ingredientId).eq("locationId", locationId)
        )
        .unique();

      if (stockRecord) {
        await ctx.db.patch(stockRecord._id, {
          quantity: stockRecord.quantity - deductionAmount,
          updatedAt: Date.now(),
        });
      } else {
        // No stock record yet — create with negative quantity
        await ctx.db.insert("ingredientStock", {
          ingredientId: recipe.ingredientId,
          locationId,
          tenantId,
          quantity: -deductionAmount,
          updatedAt: Date.now(),
        });
      }
    }
  }
}
