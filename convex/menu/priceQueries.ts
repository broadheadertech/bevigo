import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const getItemPricing = query({
  args: {
    token: v.string(),
    menuItemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const item = await ctx.db.get(args.menuItemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    const overrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.menuItemId))
      .collect();

    // Filter to only this tenant's overrides and resolve location names
    const overridesWithNames = await Promise.all(
      overrides
        .filter((o) => o.tenantId === session.tenantId)
        .map(async (o) => {
          const location = await ctx.db.get(o.locationId);
          return {
            locationId: o.locationId,
            locationName: location?.name ?? "Unknown Location",
            price: o.price,
          };
        })
    );

    // Also fetch all tenant locations so the UI can show the full table
    const allLocations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const locations = allLocations
      .filter((l) => l.status === "active")
      .map((l) => ({
        _id: l._id,
        name: l.name,
      }));

    return {
      basePrice: item.basePrice,
      overrides: overridesWithNames,
      locations,
    };
  },
});

export const getLocationPricing = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Verify location belongs to tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    // Get all active menu items for this tenant
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    // Get all overrides for this location
    const overrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    // Build a map of menuItemId -> override price
    const overrideMap = new Map<string, number>();
    for (const o of overrides) {
      if (o.tenantId === session.tenantId) {
        overrideMap.set(o.menuItemId, o.price);
      }
    }

    return items.map((item) => {
      const overridePrice = overrideMap.get(item._id);
      return {
        itemId: item._id,
        name: item.name,
        categoryId: item.categoryId,
        basePrice: item.basePrice,
        effectivePrice: overridePrice ?? item.basePrice,
        hasOverride: overridePrice !== undefined,
      };
    });
  },
});
