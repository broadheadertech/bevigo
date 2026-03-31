import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const createIngredient = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    unit: v.string(),
    category: v.optional(v.string()),
    reorderThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const now = Date.now();
    const ingredientId = await ctx.db.insert("ingredients", {
      tenantId: session.tenantId,
      name: args.name,
      unit: args.unit,
      category: args.category,
      reorderThreshold: args.reorderThreshold,
      status: "active",
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "ingredient_created",
      "ingredients",
      ingredientId,
      { name: args.name, unit: args.unit, category: args.category }
    );

    return ingredientId;
  },
});

export const updateIngredient = mutation({
  args: {
    token: v.string(),
    ingredientId: v.id("ingredients"),
    name: v.optional(v.string()),
    unit: v.optional(v.string()),
    category: v.optional(v.string()),
    reorderThreshold: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const ingredient = await ctx.db.get(args.ingredientId);
    if (!ingredient || ingredient.tenantId !== session.tenantId) {
      throw new Error("Ingredient not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.unit !== undefined) updates.unit = args.unit;
    if (args.category !== undefined) updates.category = args.category;
    if (args.reorderThreshold !== undefined)
      updates.reorderThreshold = args.reorderThreshold;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.ingredientId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "ingredient_updated",
      "ingredients",
      args.ingredientId,
      updates
    );

    return args.ingredientId;
  },
});

export const setStock = mutation({
  args: {
    token: v.string(),
    ingredientId: v.id("ingredients"),
    locationId: v.id("locations"),
    quantity: v.number(),
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

    const now = Date.now();
    const existing = await ctx.db
      .query("ingredientStock")
      .withIndex("by_ingredient_location", (q: any) =>
        q.eq("ingredientId", args.ingredientId).eq("locationId", args.locationId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
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
      "stock_set",
      "ingredientStock",
      args.ingredientId,
      {
        ingredientId: args.ingredientId,
        locationId: args.locationId,
        quantity: args.quantity,
      }
    );
  },
});
