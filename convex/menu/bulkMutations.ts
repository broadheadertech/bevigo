import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { Id } from "../_generated/dataModel";
import { generateUniqueSku } from "./skuHelpers";

export const getBulkPricingData = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    const overrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    return {
      items: items.map((item) => ({
        _id: item._id,
        name: item.name,
        basePrice: item.basePrice,
        categoryId: item.categoryId,
      })),
      locations: locations.map((loc) => ({
        _id: loc._id,
        name: loc.name,
      })),
      overrides: overrides.map((o) => ({
        menuItemId: o.menuItemId,
        locationId: o.locationId,
        price: o.price,
      })),
      categories: categories.map((c) => ({
        _id: c._id,
        name: c.name,
      })),
    };
  },
});

export const bulkUpdatePricing = mutation({
  args: {
    token: v.string(),
    updates: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        locationId: v.optional(v.id("locations")),
        newPrice: v.number(),
      })
    ),
    adjustmentType: v.union(v.literal("absolute"), v.literal("percentage")),
    adjustmentValue: v.number(),
    skipOverrides: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const now = Date.now();
    const changeLog: Array<{
      menuItemId: string;
      locationId?: string;
      oldPrice: number;
      newPrice: number;
    }> = [];

    for (const update of args.updates) {
      // Verify item belongs to tenant
      const item = await ctx.db.get(update.menuItemId);
      if (!item || item.tenantId !== session.tenantId) {
        throw new Error(`Menu item not found: ${update.menuItemId}`);
      }

      if (update.locationId) {
        // Verify location belongs to tenant
        const location = await ctx.db.get(update.locationId);
        if (!location || location.tenantId !== session.tenantId) {
          throw new Error(`Location not found: ${update.locationId}`);
        }

        // Check if override already exists
        const existing = await ctx.db
          .query("locationPriceOverrides")
          .withIndex("by_menu_item_location", (q) =>
            q
              .eq("menuItemId", update.menuItemId)
              .eq("locationId", update.locationId!)
          )
          .unique();

        if (args.skipOverrides && existing) {
          continue;
        }

        const oldPrice = existing ? existing.price : item.basePrice;

        let newPrice: number;
        if (args.adjustmentType === "percentage") {
          newPrice = Math.round(oldPrice * (1 + args.adjustmentValue / 100));
        } else {
          newPrice = update.newPrice;
        }

        if (newPrice <= 0) {
          throw new Error(
            `Invalid price for ${item.name}: price must be positive`
          );
        }

        if (existing) {
          await ctx.db.patch(existing._id, {
            price: newPrice,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("locationPriceOverrides", {
            menuItemId: update.menuItemId,
            locationId: update.locationId,
            tenantId: session.tenantId,
            price: newPrice,
            updatedAt: now,
          });
        }

        changeLog.push({
          menuItemId: String(update.menuItemId),
          locationId: String(update.locationId),
          oldPrice,
          newPrice,
        });
      } else {
        // Update base price
        if (args.skipOverrides) {
          // Check if this item has any location overrides
          const overrides = await ctx.db
            .query("locationPriceOverrides")
            .withIndex("by_menu_item", (q) =>
              q.eq("menuItemId", update.menuItemId)
            )
            .first();
          if (overrides && overrides.tenantId === session.tenantId) {
            continue;
          }
        }

        const oldPrice = item.basePrice;

        let newPrice: number;
        if (args.adjustmentType === "percentage") {
          newPrice = Math.round(oldPrice * (1 + args.adjustmentValue / 100));
        } else {
          newPrice = update.newPrice;
        }

        if (newPrice <= 0) {
          throw new Error(
            `Invalid price for ${item.name}: price must be positive`
          );
        }

        await ctx.db.patch(update.menuItemId, {
          basePrice: newPrice,
          updatedAt: now,
        });

        changeLog.push({
          menuItemId: String(update.menuItemId),
          oldPrice,
          newPrice,
        });
      }
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "bulk_price_update",
      "menuItems",
      "bulk",
      {
        adjustmentType: args.adjustmentType,
        adjustmentValue: args.adjustmentValue,
        skipOverrides: args.skipOverrides,
        totalChanges: changeLog.length,
        changes: changeLog,
      }
    );

    return { updated: changeLog.length, changes: changeLog };
  },
});

export const bulkImportItems = mutation({
  args: {
    token: v.string(),
    rows: v.array(
      v.object({
        name: v.string(),
        category: v.string(),
        basePrice: v.number(),
        sku: v.optional(v.string()),
        description: v.optional(v.string()),
        isFeatured: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const now = Date.now();

    const existingCategories = await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const categoryByName = new Map<string, Id<"categories">>();
    for (const c of existingCategories) {
      categoryByName.set(c.name.trim().toLowerCase(), c._id);
    }
    let nextCategorySort =
      existingCategories.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;

    const sortByCategory = new Map<string, number>();
    const initSort = async (categoryId: Id<"categories">) => {
      const key = String(categoryId);
      if (sortByCategory.has(key)) return;
      const items = await ctx.db
        .query("menuItems")
        .withIndex("by_tenant_category", (q) =>
          q.eq("tenantId", session.tenantId).eq("categoryId", categoryId)
        )
        .collect();
      const max = items.reduce((m, it) => Math.max(m, it.sortOrder), 0);
      sortByCategory.set(key, max);
    };

    // Pre-load every SKU already in use so we can probe collisions in-memory
    // when generating SKUs for rows that didn't supply one.
    const allItems = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const usedSkus = new Set<string>();
    for (const it of allItems) {
      if (it.sku) usedSkus.add(it.sku);
    }

    let created = 0;
    let createdCategories = 0;
    const skipped: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      const rowNum = i + 1;

      const name = row.name.trim();
      const categoryName = row.category.trim();
      if (!name) {
        skipped.push({ row: rowNum, reason: "Missing name" });
        continue;
      }
      if (!categoryName) {
        skipped.push({ row: rowNum, reason: "Missing category" });
        continue;
      }
      if (!Number.isFinite(row.basePrice) || row.basePrice <= 0) {
        skipped.push({ row: rowNum, reason: "Invalid basePrice" });
        continue;
      }

      let sku = row.sku?.trim() || undefined;
      if (sku) {
        if (usedSkus.has(sku)) {
          skipped.push({ row: rowNum, reason: `SKU already exists: ${sku}` });
          continue;
        }
      } else {
        // Auto-generate from the product name. Format: first-3-letters of
        // up to three words, joined by dashes, with a numeric suffix only
        // appended when needed to avoid collision.
        sku = generateUniqueSku(name, usedSkus);
      }
      usedSkus.add(sku);

      const catKey = categoryName.toLowerCase();
      let categoryId = categoryByName.get(catKey);
      if (!categoryId) {
        categoryId = await ctx.db.insert("categories", {
          tenantId: session.tenantId,
          name: categoryName,
          sortOrder: nextCategorySort++,
          status: "active",
          updatedAt: now,
        });
        categoryByName.set(catKey, categoryId);
        createdCategories++;
      }

      await initSort(categoryId);
      const key = String(categoryId);
      const nextSort = (sortByCategory.get(key) ?? 0) + 1;
      sortByCategory.set(key, nextSort);

      await ctx.db.insert("menuItems", {
        tenantId: session.tenantId,
        categoryId,
        name,
        description: row.description?.trim() || undefined,
        basePrice: Math.round(row.basePrice),
        sku,
        isFeatured: row.isFeatured ?? false,
        sortOrder: nextSort,
        status: "active",
        updatedAt: now,
      });
      created++;
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "menu_items_bulk_imported",
      "menuItems",
      "bulk",
      { created, createdCategories, skipped: skipped.length },
    );

    return { created, createdCategories, skipped };
  },
});
