import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { Id } from "../_generated/dataModel";

/**
 * Restock helper — bulk-add many ingredients to stock in one shot, all
 * sharing the same batch label + date so they show up grouped in the
 * adjustment history. Use it when a delivery comes in: pick the items
 * you received, type the qty, hit save.
 */
export const restockBatch = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    batchLabel: v.string(),
    batchDate: v.number(),
    supplierId: v.optional(v.id("suppliers")),
    notes: v.optional(v.string()),
    rows: v.array(
      v.object({
        ingredientId: v.id("ingredients"),
        quantity: v.number(), // positive — quantity received
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }
    if (args.supplierId) {
      const sup = await ctx.db.get(args.supplierId);
      if (!sup || sup.tenantId !== session.tenantId) {
        throw new Error("Supplier not found");
      }
    }
    const batchLabel = args.batchLabel.trim();
    if (!batchLabel) throw new Error("Batch label is required");
    if (args.rows.length === 0) {
      throw new Error("Add at least one ingredient to the batch");
    }

    const now = Date.now();
    const reason =
      args.notes?.trim() ||
      `Restock · ${batchLabel}`;
    const adjustmentIds: Id<"stockAdjustments">[] = [];

    for (const row of args.rows) {
      if (row.quantity <= 0) continue; // ignore blank lines silently

      const ingredient = await ctx.db.get(row.ingredientId);
      if (!ingredient || ingredient.tenantId !== session.tenantId) {
        throw new Error(`Ingredient ${row.ingredientId} not found`);
      }

      const adjId = await ctx.db.insert("stockAdjustments", {
        ingredientId: row.ingredientId,
        locationId: args.locationId,
        tenantId: session.tenantId,
        userId: session.userId,
        type: "restock",
        quantity: row.quantity,
        reason,
        batchLabel,
        batchDate: args.batchDate,
        supplierId: args.supplierId,
        createdAt: now,
      });
      adjustmentIds.push(adjId);

      const existing = await ctx.db
        .query("ingredientStock")
        .withIndex("by_ingredient_location", (q: any) =>
          q.eq("ingredientId", row.ingredientId).eq("locationId", args.locationId)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          quantity: existing.quantity + row.quantity,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("ingredientStock", {
          ingredientId: row.ingredientId,
          locationId: args.locationId,
          tenantId: session.tenantId,
          quantity: row.quantity,
          updatedAt: now,
        });
      }
    }

    if (adjustmentIds.length === 0) {
      throw new Error("Every row had zero quantity — nothing was restocked");
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "stock_restock_batch",
      "stockAdjustments",
      adjustmentIds[0],
      {
        batchLabel,
        batchDate: args.batchDate,
        locationId: args.locationId,
        supplierId: args.supplierId,
        rowCount: adjustmentIds.length,
      }
    );

    return { adjustmentIds, batchLabel };
  },
});

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

export const bulkStocktake = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    rows: v.array(
      v.object({
        ingredientName: v.string(),
        countedQuantity: v.number(),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const allIngredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const ingByName = new Map<string, Id<"ingredients">>();
    for (const ing of allIngredients) {
      ingByName.set(ing.name.trim().toLowerCase(), ing._id);
    }

    let recorded = 0;
    let unchanged = 0;
    const skipped: Array<{ row: number; reason: string }> = [];
    const now = Date.now();

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      const rowNum = i + 1;

      const name = row.ingredientName.trim();
      if (!name) {
        skipped.push({ row: rowNum, reason: "Missing ingredientName" });
        continue;
      }
      if (!Number.isFinite(row.countedQuantity) || row.countedQuantity < 0) {
        skipped.push({ row: rowNum, reason: "Invalid countedQuantity" });
        continue;
      }
      const ingredientId = ingByName.get(name.toLowerCase());
      if (!ingredientId) {
        skipped.push({ row: rowNum, reason: `Unknown ingredient: ${name}` });
        continue;
      }

      const existing = await ctx.db
        .query("ingredientStock")
        .withIndex("by_ingredient_location", (q) =>
          q.eq("ingredientId", ingredientId).eq("locationId", args.locationId)
        )
        .unique();

      const before = existing?.quantity ?? 0;
      const delta = row.countedQuantity - before;

      if (delta === 0) {
        unchanged++;
        continue;
      }

      await ctx.db.insert("stockAdjustments", {
        ingredientId,
        locationId: args.locationId,
        tenantId: session.tenantId,
        userId: session.userId,
        type: "stocktake",
        quantity: delta,
        reason: row.notes?.trim() || `Stocktake: ${before} → ${row.countedQuantity}`,
        createdAt: now,
      });

      if (existing) {
        await ctx.db.patch(existing._id, {
          quantity: row.countedQuantity,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("ingredientStock", {
          ingredientId,
          locationId: args.locationId,
          tenantId: session.tenantId,
          quantity: row.countedQuantity,
          updatedAt: now,
        });
      }

      recorded++;
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "stocktake_bulk_imported",
      "stockAdjustments",
      "bulk",
      {
        locationId: args.locationId,
        recorded,
        unchanged,
        skipped: skipped.length,
      }
    );

    return { recorded, unchanged, skipped };
  },
});
