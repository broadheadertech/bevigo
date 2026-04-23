import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { Id } from "../_generated/dataModel";

const ALLOWED_UNITS = new Set(["g", "kg", "ml", "L", "pcs"]);

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

/**
 * Hard-delete an ingredient — refuses if anything still references it.
 * Use updateIngredient with status="inactive" for the soft-delete path.
 */
export const deleteIngredient = mutation({
  args: {
    token: v.string(),
    ingredientId: v.id("ingredients"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const ingredient = await ctx.db.get(args.ingredientId);
    if (!ingredient || ingredient.tenantId !== session.tenantId) {
      throw new Error("Ingredient not found");
    }

    const recipeUses = await ctx.db
      .query("recipes")
      .withIndex("by_ingredient", (q) => q.eq("ingredientId", args.ingredientId))
      .collect();
    const stockRows = await ctx.db
      .query("ingredientStock")
      .withIndex("by_ingredient", (q) => q.eq("ingredientId", args.ingredientId))
      .collect();
    const adjustments = await ctx.db
      .query("stockAdjustments")
      .withIndex("by_ingredient", (q) => q.eq("ingredientId", args.ingredientId))
      .collect();
    // purchaseOrderItems has no by_ingredient index — scan tenant and filter.
    const purchaseRefs = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .filter((q) => q.eq(q.field("ingredientId"), args.ingredientId))
      .collect();

    const stockTotal = stockRows.reduce((sum, s) => sum + s.quantity, 0);

    const blockers: string[] = [];
    if (recipeUses.length > 0) blockers.push(`${recipeUses.length} recipe(s)`);
    if (stockTotal > 0) blockers.push(`${stockTotal} ${ingredient.unit} on hand`);
    if (adjustments.length > 0) blockers.push(`${adjustments.length} stock adjustment(s)`);
    if (purchaseRefs.length > 0) blockers.push(`${purchaseRefs.length} purchase order line(s)`);

    if (blockers.length > 0) {
      throw new Error(
        `Cannot delete "${ingredient.name}" — still referenced by: ${blockers.join(", ")}. Deactivate it instead.`
      );
    }

    // Safe to clean up zero-quantity stock rows before deleting the ingredient.
    for (const s of stockRows) {
      await ctx.db.delete(s._id);
    }
    await ctx.db.delete(args.ingredientId);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "ingredient_deleted",
      "ingredients",
      args.ingredientId,
      { name: ingredient.name }
    );

    return args.ingredientId;
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

export const bulkImportIngredients = mutation({
  args: {
    token: v.string(),
    rows: v.array(
      v.object({
        name: v.string(),
        unit: v.string(),
        reorderThreshold: v.number(),
        category: v.optional(v.string()),
        initialStock: v.optional(v.number()),
        location: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const now = Date.now();

    const existingIngredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const ingredientByName = new Map<string, true>();
    for (const ing of existingIngredients) {
      ingredientByName.set(ing.name.trim().toLowerCase(), true);
    }

    const allLocations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const locationByName = new Map<string, Id<"locations">>();
    for (const loc of allLocations) {
      locationByName.set(loc.name.trim().toLowerCase(), loc._id);
    }

    let created = 0;
    let stockSeeded = 0;
    const skipped: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      const rowNum = i + 1;

      const name = row.name.trim();
      const unit = row.unit.trim();
      if (!name) {
        skipped.push({ row: rowNum, reason: "Missing name" });
        continue;
      }
      if (!ALLOWED_UNITS.has(unit)) {
        skipped.push({
          row: rowNum,
          reason: `Invalid unit "${unit}" (allowed: g, kg, ml, L, pcs)`,
        });
        continue;
      }
      if (!Number.isFinite(row.reorderThreshold) || row.reorderThreshold < 0) {
        skipped.push({ row: rowNum, reason: "Invalid reorderThreshold" });
        continue;
      }
      if (ingredientByName.has(name.toLowerCase())) {
        skipped.push({ row: rowNum, reason: `Name already exists: ${name}` });
        continue;
      }

      let locationId: Id<"locations"> | null = null;
      if (row.initialStock !== undefined && row.initialStock !== 0) {
        if (!row.location?.trim()) {
          skipped.push({
            row: rowNum,
            reason: "location is required when initialStock is set",
          });
          continue;
        }
        const lid = locationByName.get(row.location.trim().toLowerCase());
        if (!lid) {
          skipped.push({
            row: rowNum,
            reason: `Unknown location: ${row.location}`,
          });
          continue;
        }
        locationId = lid;
      }

      const ingredientId = await ctx.db.insert("ingredients", {
        tenantId: session.tenantId,
        name,
        unit,
        category: row.category?.trim() || undefined,
        reorderThreshold: row.reorderThreshold,
        status: "active",
        updatedAt: now,
      });
      ingredientByName.set(name.toLowerCase(), true);
      created++;

      if (locationId && row.initialStock !== undefined) {
        await ctx.db.insert("ingredientStock", {
          ingredientId,
          locationId,
          tenantId: session.tenantId,
          quantity: row.initialStock,
          updatedAt: now,
        });
        stockSeeded++;
      }
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "ingredients_bulk_imported",
      "ingredients",
      "bulk",
      { created, stockSeeded, skipped: skipped.length }
    );

    return { created, stockSeeded, skipped };
  },
});
