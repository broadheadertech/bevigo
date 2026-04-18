import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { Id } from "../_generated/dataModel";

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

export const bulkImportRecipes = mutation({
  args: {
    token: v.string(),
    rows: v.array(
      v.object({
        menuItemSku: v.string(),
        ingredientName: v.string(),
        quantityUsed: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const allItems = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const itemBySku = new Map<string, Id<"menuItems">>();
    for (const it of allItems) {
      if (it.sku) itemBySku.set(it.sku.trim().toLowerCase(), it._id);
    }

    const allIngredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const ingByName = new Map<string, Id<"ingredients">>();
    for (const ing of allIngredients) {
      ingByName.set(ing.name.trim().toLowerCase(), ing._id);
    }

    let created = 0;
    let updated = 0;
    const skipped: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      const rowNum = i + 1;

      const sku = row.menuItemSku.trim();
      const ingName = row.ingredientName.trim();
      if (!sku) {
        skipped.push({ row: rowNum, reason: "Missing menuItemSku" });
        continue;
      }
      if (!ingName) {
        skipped.push({ row: rowNum, reason: "Missing ingredientName" });
        continue;
      }
      if (!Number.isFinite(row.quantityUsed) || row.quantityUsed <= 0) {
        skipped.push({ row: rowNum, reason: "Invalid quantityUsed" });
        continue;
      }

      const menuItemId = itemBySku.get(sku.toLowerCase());
      if (!menuItemId) {
        skipped.push({ row: rowNum, reason: `Unknown menu item SKU: ${sku}` });
        continue;
      }
      const ingredientId = ingByName.get(ingName.toLowerCase());
      if (!ingredientId) {
        skipped.push({
          row: rowNum,
          reason: `Unknown ingredient: ${ingName}`,
        });
        continue;
      }

      const existing = await ctx.db
        .query("recipes")
        .withIndex("by_menu_item", (q) => q.eq("menuItemId", menuItemId))
        .collect();
      const dup = existing.find((r) => r.ingredientId === ingredientId);
      if (dup) {
        await ctx.db.patch(dup._id, { quantityUsed: row.quantityUsed });
        updated++;
      } else {
        await ctx.db.insert("recipes", {
          menuItemId,
          ingredientId,
          tenantId: session.tenantId,
          quantityUsed: row.quantityUsed,
        });
        created++;
      }
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "recipes_bulk_imported",
      "recipes",
      "bulk",
      { created, updated, skipped: skipped.length }
    );

    return { created, updated, skipped };
  },
});
