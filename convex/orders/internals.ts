import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { logAuditEntry } from "../audit/helpers";

export const validateOrderForVoid = internalQuery({
  args: {
    orderId: v.id("orders"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) {
      return { error: "Unauthorized" };
    }

    const user = await ctx.db.get(session.userId);
    if (!user || user.status !== "active") {
      return { error: "Unauthorized" };
    }

    // Validate order
    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      return { error: "Order not found" };
    }
    if (order.status !== "completed") {
      return { error: "Only completed orders can be voided" };
    }

    // Get eligible authorizers (manager/owner at the order's location with a PIN)
    const userLocs = await ctx.db
      .query("userLocations")
      .withIndex("by_location", (q) => q.eq("locationId", order.locationId))
      .collect();

    const authorizers: Array<{
      _id: string;
      quickPinHash: string;
      name: string;
      tenantId: string;
    }> = [];

    for (const ul of userLocs) {
      const u = await ctx.db.get(ul.userId);
      if (
        u &&
        u.status === "active" &&
        u.quickPinHash &&
        (u.role === "manager" || u.role === "owner")
      ) {
        authorizers.push({
          _id: u._id as string,
          quickPinHash: u.quickPinHash,
          name: u.name,
          tenantId: u.tenantId as string,
        });
      }
    }

    if (authorizers.length === 0) {
      return { error: "No eligible authorizers at this location" };
    }

    return {
      order: {
        _id: order._id as string,
        tenantId: order.tenantId as string,
        locationId: order.locationId as string,
      },
      authorizers,
      sessionUserId: session.userId as string,
    };
  },
});

export const executeVoid = internalMutation({
  args: {
    orderId: v.id("orders"),
    voidedBy: v.id("users"),
    voidReason: v.string(),
    tenantId: v.id("tenants"),
    authorizerName: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await ctx.db.patch(args.orderId, {
      status: "voided",
      voidedBy: args.voidedBy,
      voidReason: args.voidReason,
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      args.tenantId,
      args.voidedBy,
      "order.void",
      "order",
      args.orderId,
      {
        previousStatus: "completed",
        newStatus: "voided",
        voidReason: args.voidReason,
        authorizerName: args.authorizerName,
        orderTotal: order.total,
      }
    );
  },
});

export const logVoidFailure = internalMutation({
  args: {
    orderId: v.id("orders"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await logAuditEntry(
      ctx,
      args.tenantId,
      args.userId,
      "order.void.failed",
      "order",
      args.orderId,
      {
        reason: "Invalid authorizer PIN",
      }
    );
  },
});
