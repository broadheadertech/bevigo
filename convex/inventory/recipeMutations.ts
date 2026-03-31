import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const addRecipeItem = mutation({
  args: {
    token: v.string(),
    menuItemId: v.id("menuItems"),
    ingredientId: v.id("ingredients"),
    quantityUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem || menuItem.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    const ingredient = await ctx.db.get(args.ingredientId);
    if (!ingredient || ingredient.tenantId !== session.tenantId) {
      throw new Error("Ingredient not found");
    }

    // Check for duplicate
    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_menu_item", (q: any) => q.eq("menuItemId", args.menuItemId))
      .collect();

    const duplicate = existing.find(
      (r: { ingredientId: string }) => r.ingredientId === args.ingredientId
    );
    if (duplicate) {
      throw new Error("This ingredient is already in the recipe");
    }

    const recipeId = await ctx.db.insert("recipes", {
      menuItemId: args.menuItemId,
      ingredientId: args.ingredientId,
      tenantId: session.tenantId,
      quantityUsed: args.quantityUsed,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "recipe_item_added",
      "recipes",
      recipeId,
      {
        menuItemId: args.menuItemId,
        ingredientId: args.ingredientId,
        quantityUsed: args.quantityUsed,
      }
    );

    return recipeId;
  },
});

export const updateRecipeItem = mutation({
  args: {
    token: v.string(),
    recipeId: v.id("recipes"),
    quantityUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.tenantId !== session.tenantId) {
      throw new Error("Recipe item not found");
    }

    await ctx.db.patch(args.recipeId, {
      quantityUsed: args.quantityUsed,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "recipe_item_updated",
      "recipes",
      args.recipeId,
      { quantityUsed: args.quantityUsed }
    );

    return args.recipeId;
  },
});

export const removeRecipeItem = mutation({
  args: {
    token: v.string(),
    recipeId: v.id("recipes"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.tenantId !== session.tenantId) {
      throw new Error("Recipe item not found");
    }

    await ctx.db.delete(args.recipeId);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "recipe_item_removed",
      "recipes",
      args.recipeId,
      {
        menuItemId: recipe.menuItemId,
        ingredientId: recipe.ingredientId,
      }
    );
  },
});
