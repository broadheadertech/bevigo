import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "./lib/auth";
import { generateUniqueSku } from "./menu/skuHelpers";

/**
 * One-shot helper that assigns the new {catLetter}{nameLetter}{NNN} SKU to
 * every menu item and ingredient that doesn't already have one. Existing
 * SKUs are left alone so we don't break references in printed media.
 *
 * Owner-only and idempotent — running it twice does nothing on the second
 * pass.
 */
export const backfillSkus = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    let menuFilled = 0;
    let ingredientFilled = 0;

    // ── Menu items ──
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const usedItemSkus = new Set<string>();
    for (const it of items) if (it.sku) usedItemSkus.add(it.sku);

    for (const item of items) {
      if (item.sku) continue;
      const category = await ctx.db.get(item.categoryId);
      const sku = generateUniqueSku(item.name, usedItemSkus, category?.name);
      usedItemSkus.add(sku);
      await ctx.db.patch(item._id, { sku, updatedAt: Date.now() });
      menuFilled++;
    }

    // ── Ingredients ──
    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const usedIngSkus = new Set<string>();
    for (const ing of ingredients) if (ing.sku) usedIngSkus.add(ing.sku);

    for (const ing of ingredients) {
      if (ing.sku) continue;
      const sku = generateUniqueSku(
        ing.name,
        usedIngSkus,
        ing.category ?? "Ingredient"
      );
      usedIngSkus.add(sku);
      await ctx.db.patch(ing._id, { sku, updatedAt: Date.now() });
      ingredientFilled++;
    }

    return { menuFilled, ingredientFilled };
  },
});
