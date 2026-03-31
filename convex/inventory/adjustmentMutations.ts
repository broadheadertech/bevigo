import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const logAdjustment = mutation({
  args: {
    token: v.string(),
    ingredientId: v.id("ingredients"),
    locationId: v.id("locations"),
    type: v.union(
      v.literal("wastage"),
      v.literal("correction"),
      v.literal("stocktake"),
      v.literal("transfer")
    ),
    quantity: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const ingredient = await ctx.db.get(args.ingredientId);
    if (!ingredient || ingredient.tenantId !== session.tenantId) {
      throw new Error("Ingredient not found");
    }

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    if (!args.reason.trim()) {
      throw new Error("Reason is required");
    }

    const now = Date.now();

    // Create adjustment record
    const adjustmentId = await ctx.db.insert("stockAdjustments", {
      ingredientId: args.ingredientId,
      locationId: args.locationId,
      tenantId: session.tenantId,
      userId: session.userId,
      type: args.type,
      quantity: args.quantity,
      reason: args.reason.trim(),
      createdAt: now,
    });

    // Update ingredient stock
    const existing = await ctx.db
      .query("ingredientStock")
      .withIndex("by_ingredient_location", (q: any) =>
        q
          .eq("ingredientId", args.ingredientId)
          .eq("locationId", args.locationId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: existing.quantity + args.quantity,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("ingredientStock", {
        ingredientId: args.ingredientId,
        locationId: args.locationId,
        tenantId: session.tenantId,
        quantity: args.quantity,
        updatedAt: now,
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "stock_adjustment_logged",
      "stockAdjustments",
      adjustmentId,
      {
        ingredientId: args.ingredientId,
        locationId: args.locationId,
        type: args.type,
        quantity: args.quantity,
        reason: args.reason.trim(),
      }
    );

    return adjustmentId;
  },
});
