import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

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
