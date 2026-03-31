import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const createPurchaseOrder = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    supplier: v.string(),
    notes: v.optional(v.string()),
    items: v.array(
      v.object({
        ingredientId: v.id("ingredients"),
        quantityOrdered: v.number(),
        unitCost: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    if (args.items.length === 0) {
      throw new Error("Purchase order must have at least one item");
    }

    // Validate all ingredients belong to tenant
    for (const item of args.items) {
      const ingredient = await ctx.db.get(item.ingredientId);
      if (!ingredient || ingredient.tenantId !== session.tenantId) {
        throw new Error("Ingredient not found");
      }
    }

    const now = Date.now();

    const purchaseOrderId = await ctx.db.insert("purchaseOrders", {
      tenantId: session.tenantId,
      locationId: args.locationId,
      userId: session.userId,
      supplier: args.supplier,
      status: "draft",
      notes: args.notes,
      updatedAt: now,
    });

    for (const item of args.items) {
      await ctx.db.insert("purchaseOrderItems", {
        purchaseOrderId,
        ingredientId: item.ingredientId,
        tenantId: session.tenantId,
        quantityOrdered: item.quantityOrdered,
        unitCost: item.unitCost,
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "purchase_order_created",
      "purchaseOrders",
      purchaseOrderId,
      {
        supplier: args.supplier,
        locationId: args.locationId,
        itemCount: args.items.length,
      }
    );

    return purchaseOrderId;
  },
});

export const updatePurchaseOrderStatus = mutation({
  args: {
    token: v.string(),
    purchaseOrderId: v.id("purchaseOrders"),
    status: v.union(
      v.literal("draft"),
      v.literal("ordered"),
      v.literal("received"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const order = await ctx.db.get(args.purchaseOrderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Purchase order not found");
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "ordered") {
      updates.orderedAt = now;
    }

    if (args.status === "received") {
      updates.receivedAt = now;

      // Add ordered quantities to stock
      const items = await ctx.db
        .query("purchaseOrderItems")
        .withIndex("by_purchase_order", (q: any) =>
          q.eq("purchaseOrderId", args.purchaseOrderId)
        )
        .collect();

      for (const item of items) {
        const existing = await ctx.db
          .query("ingredientStock")
          .withIndex("by_ingredient_location", (q: any) =>
            q
              .eq("ingredientId", item.ingredientId)
              .eq("locationId", order.locationId)
          )
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            quantity: existing.quantity + item.quantityOrdered,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("ingredientStock", {
            ingredientId: item.ingredientId,
            locationId: order.locationId,
            tenantId: session.tenantId,
            quantity: item.quantityOrdered,
            updatedAt: now,
          });
        }
      }
    }

    await ctx.db.patch(args.purchaseOrderId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "purchase_order_status_updated",
      "purchaseOrders",
      args.purchaseOrderId,
      { previousStatus: order.status, newStatus: args.status }
    );

    return args.purchaseOrderId;
  },
});

export const receivePurchaseOrder = mutation({
  args: {
    token: v.string(),
    purchaseOrderId: v.id("purchaseOrders"),
    receivedItems: v.array(
      v.object({
        purchaseOrderItemId: v.id("purchaseOrderItems"),
        quantityReceived: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const order = await ctx.db.get(args.purchaseOrderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Purchase order not found");
    }

    if (order.status === "received") {
      throw new Error("Purchase order already received");
    }

    if (order.status === "cancelled") {
      throw new Error("Cannot receive a cancelled purchase order");
    }

    const now = Date.now();

    for (const received of args.receivedItems) {
      const poItem = await ctx.db.get(received.purchaseOrderItemId);
      if (!poItem || poItem.purchaseOrderId !== args.purchaseOrderId) {
        throw new Error("Purchase order item not found");
      }

      // Update PO item with received quantity
      await ctx.db.patch(received.purchaseOrderItemId, {
        quantityReceived: received.quantityReceived,
      });

      // Update ingredient stock
      const existing = await ctx.db
        .query("ingredientStock")
        .withIndex("by_ingredient_location", (q: any) =>
          q
            .eq("ingredientId", poItem.ingredientId)
            .eq("locationId", order.locationId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          quantity: existing.quantity + received.quantityReceived,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("ingredientStock", {
          ingredientId: poItem.ingredientId,
          locationId: order.locationId,
          tenantId: session.tenantId,
          quantity: received.quantityReceived,
          updatedAt: now,
        });
      }
    }

    // Update PO status to received
    await ctx.db.patch(args.purchaseOrderId, {
      status: "received",
      receivedAt: now,
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "purchase_order_received",
      "purchaseOrders",
      args.purchaseOrderId,
      {
        receivedItems: args.receivedItems.map(
          (ri: {
            purchaseOrderItemId: string;
            quantityReceived: number;
          }) => ({
            purchaseOrderItemId: ri.purchaseOrderItemId,
            quantityReceived: ri.quantityReceived,
          })
        ),
      }
    );

    return args.purchaseOrderId;
  },
});
