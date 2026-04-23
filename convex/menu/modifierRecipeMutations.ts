import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import type { Doc } from "../_generated/dataModel";

/**
 * Per-modifier ingredient consumption.
 *
 * Each row says: when this modifier is chosen, deduct `quantityUsed` of
 * `ingredientId` per unit ordered. If `replacesIngredientId` is set, the
 * matching base/variant ingredient is REMOVED from the deduction first
 * (perfect for milk swaps: "Oat Milk" replaces "Regular Milk" 1:1).
 */
export const listForModifier = query({
  args: { token: v.string(), modifierId: v.id("modifiers") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const mod = await ctx.db.get(args.modifierId);
    if (!mod || mod.tenantId !== session.tenantId) {
      throw new Error("Modifier not found");
    }

    const rows = await ctx.db
      .query("modifierRecipes")
      .withIndex("by_modifier", (q) => q.eq("modifierId", args.modifierId))
      .collect();

    const results: Array<{
      _id: Doc<"modifierRecipes">["_id"];
      ingredientId: Doc<"modifierRecipes">["ingredientId"];
      ingredientName: string;
      ingredientUnit: string;
      quantityUsed: number;
      replacesIngredientId?: Doc<"modifierRecipes">["replacesIngredientId"];
      replacesIngredientName?: string;
      variantKey: string | null;
      priceAdjustment: number | null;
    }> = [];
    for (const r of rows) {
      const ing = await ctx.db.get(r.ingredientId);
      const replaces = r.replacesIngredientId
        ? await ctx.db.get(r.replacesIngredientId)
        : null;
      results.push({
        _id: r._id,
        ingredientId: r.ingredientId,
        ingredientName: ing?.name ?? "Unknown",
        ingredientUnit: ing?.unit ?? "",
        quantityUsed: r.quantityUsed,
        replacesIngredientId: r.replacesIngredientId,
        replacesIngredientName: replaces?.name,
        variantKey: r.variantKey ?? null,
        priceAdjustment: r.priceAdjustment ?? null,
      });
    }
    return results;
  },
});

export const addForModifier = mutation({
  args: {
    token: v.string(),
    modifierId: v.id("modifiers"),
    ingredientId: v.id("ingredients"),
    quantityUsed: v.number(),
    replacesIngredientId: v.optional(v.id("ingredients")),
    /** Optional — size-specific delta (e.g. "500ml"). Must match a modifier
     *  name on the same order line for the row to apply. */
    variantKey: v.optional(v.string()),
    /** Optional — per-variant price override in cents. Only honored when
     *  variantKey is also set (otherwise the modifier's own price is used). */
    priceAdjustment: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const mod = await ctx.db.get(args.modifierId);
    if (!mod || mod.tenantId !== session.tenantId) {
      throw new Error("Modifier not found");
    }
    const ing = await ctx.db.get(args.ingredientId);
    if (!ing || ing.tenantId !== session.tenantId) {
      throw new Error("Ingredient not found");
    }
    if (args.replacesIngredientId) {
      const repl = await ctx.db.get(args.replacesIngredientId);
      if (!repl || repl.tenantId !== session.tenantId) {
        throw new Error("Replaced ingredient not found");
      }
    }

    const variantKey = args.variantKey?.trim() || undefined;

    // Duplicate check is per (modifier, ingredient, variantKey) so the same
    // ingredient can appear once per size variant plus a default row.
    const existing = await ctx.db
      .query("modifierRecipes")
      .withIndex("by_modifier", (q) => q.eq("modifierId", args.modifierId))
      .collect();
    if (
      existing.some(
        (r) =>
          r.ingredientId === args.ingredientId &&
          (r.variantKey ?? undefined) === variantKey
      )
    ) {
      throw new Error(
        variantKey
          ? `This ingredient is already in the "${variantKey}" variant for this modifier`
          : "This ingredient is already in the modifier recipe"
      );
    }

    const id = await ctx.db.insert("modifierRecipes", {
      modifierId: args.modifierId,
      ingredientId: args.ingredientId,
      tenantId: session.tenantId,
      quantityUsed: args.quantityUsed,
      replacesIngredientId: args.replacesIngredientId,
      variantKey,
      // Only meaningful when variantKey is set; ignored otherwise.
      priceAdjustment:
        variantKey && args.priceAdjustment !== undefined
          ? args.priceAdjustment
          : undefined,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "modifier_recipe_added",
      "modifierRecipes",
      id,
      {
        modifierId: args.modifierId,
        ingredientId: args.ingredientId,
        quantityUsed: args.quantityUsed,
        replacesIngredientId: args.replacesIngredientId,
      }
    );

    return id;
  },
});

export const updateForModifier = mutation({
  args: {
    token: v.string(),
    rowId: v.id("modifierRecipes"),
    quantityUsed: v.optional(v.number()),
    replacesIngredientId: v.optional(v.id("ingredients")),
    /** Pass null to clear the replacement link. */
    clearReplacement: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const row = await ctx.db.get(args.rowId);
    if (!row || row.tenantId !== session.tenantId) {
      throw new Error("Modifier recipe row not found");
    }

    const updates: Partial<Doc<"modifierRecipes">> = {};
    if (args.quantityUsed !== undefined) updates.quantityUsed = args.quantityUsed;
    if (args.clearReplacement) updates.replacesIngredientId = undefined;
    else if (args.replacesIngredientId !== undefined)
      updates.replacesIngredientId = args.replacesIngredientId;

    await ctx.db.patch(args.rowId, updates);
    return args.rowId;
  },
});

export const removeForModifier = mutation({
  args: { token: v.string(), rowId: v.id("modifierRecipes") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const row = await ctx.db.get(args.rowId);
    if (!row || row.tenantId !== session.tenantId) {
      throw new Error("Modifier recipe row not found");
    }
    await ctx.db.delete(args.rowId);
  },
});
