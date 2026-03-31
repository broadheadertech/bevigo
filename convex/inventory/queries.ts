import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { Doc } from "../_generated/dataModel";

export const listIngredients = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", session.tenantId))
      .collect();

    const results = await Promise.all(
      ingredients.map(async (ingredient: Doc<"ingredients">) => {
        let stockQuantity: number | null = null;

        if (args.locationId) {
          const stock = await ctx.db
            .query("ingredientStock")
            .withIndex("by_ingredient_location", (q: any) =>
              q.eq("ingredientId", ingredient._id).eq("locationId", args.locationId!)
            )
            .unique();
          stockQuantity = stock?.quantity ?? 0;
        }

        return {
          ...ingredient,
          stockQuantity,
        };
      })
    );

    return results;
  },
});

export const getIngredient = query({
  args: {
    token: v.string(),
    ingredientId: v.id("ingredients"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const ingredient = await ctx.db.get(args.ingredientId);
    if (!ingredient || ingredient.tenantId !== session.tenantId) {
      throw new Error("Ingredient not found");
    }

    // Get stock across all locations
    const stockEntries = await ctx.db
      .query("ingredientStock")
      .withIndex("by_ingredient", (q: any) => q.eq("ingredientId", args.ingredientId))
      .collect();

    const stockByLocation = await Promise.all(
      stockEntries.map(async (entry: Doc<"ingredientStock">) => {
        const location = await ctx.db.get(entry.locationId);
        return {
          locationId: entry.locationId,
          locationName: location?.name ?? "Unknown",
          quantity: entry.quantity,
          updatedAt: entry.updatedAt,
        };
      })
    );

    // Get recipe usage
    const recipeEntries = await ctx.db
      .query("recipes")
      .withIndex("by_ingredient", (q: any) => q.eq("ingredientId", args.ingredientId))
      .collect();

    const recipeUsage = await Promise.all(
      recipeEntries.map(async (entry: Doc<"recipes">) => {
        const menuItem = await ctx.db.get(entry.menuItemId);
        return {
          recipeId: entry._id,
          menuItemId: entry.menuItemId,
          menuItemName: menuItem?.name ?? "Unknown",
          quantityUsed: entry.quantityUsed,
        };
      })
    );

    return {
      ...ingredient,
      stockByLocation,
      recipeUsage,
    };
  },
});

export const getLowStock = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant_status", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    const lowStockItems = await Promise.all(
      ingredients.map(async (ingredient: Doc<"ingredients">) => {
        const stock = await ctx.db
          .query("ingredientStock")
          .withIndex("by_ingredient_location", (q: any) =>
            q.eq("ingredientId", ingredient._id).eq("locationId", args.locationId)
          )
          .unique();

        const quantity = stock?.quantity ?? 0;

        if (quantity < ingredient.reorderThreshold) {
          return {
            ...ingredient,
            stockQuantity: quantity,
            deficit: ingredient.reorderThreshold - quantity,
          };
        }
        return null;
      })
    );

    return lowStockItems.filter(
      (item: { stockQuantity: number; deficit: number } | null) => item !== null
    );
  },
});
