import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { Doc } from "../_generated/dataModel";

export const getRecipeForItem = query({
  args: {
    token: v.string(),
    menuItemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem || menuItem.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    const recipeEntries = await ctx.db
      .query("recipes")
      .withIndex("by_menu_item", (q: any) => q.eq("menuItemId", args.menuItemId))
      .collect();

    const items = await Promise.all(
      recipeEntries.map(async (entry: Doc<"recipes">) => {
        const ingredient = await ctx.db.get(entry.ingredientId);
        return {
          _id: entry._id,
          ingredientId: entry.ingredientId,
          ingredientName: ingredient?.name ?? "Unknown",
          ingredientUnit: ingredient?.unit ?? "",
          quantityUsed: entry.quantityUsed,
        };
      })
    );

    return items;
  },
});

export const getItemsUsingIngredient = query({
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

    const recipeEntries = await ctx.db
      .query("recipes")
      .withIndex("by_ingredient", (q: any) => q.eq("ingredientId", args.ingredientId))
      .collect();

    const items = await Promise.all(
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

    return items;
  },
});
