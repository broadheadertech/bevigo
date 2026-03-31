import { query } from "../_generated/server";
import { v } from "convex/values";

export const getPublicMenu = query({
  args: {
    locationSlug: v.string(),
  },
  handler: async (ctx, args) => {
    // Find location by slug (no auth required)
    const location = await ctx.db
      .query("locations")
      .withIndex("by_slug", (q) => q.eq("slug", args.locationSlug))
      .first();

    if (!location || location.status !== "active") {
      return null;
    }

    const tenantId = location.tenantId;

    // Get all active categories sorted by sortOrder
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant_sort", (q) => q.eq("tenantId", tenantId))
      .collect();

    const activeCategories = categories.filter((c) => c.status === "active");

    // Get all active menu items for this tenant
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "active")
      )
      .collect();

    // Get all price overrides for this location
    const overrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_location", (q) => q.eq("locationId", location._id))
      .collect();

    const overrideMap = new Map<string, number>();
    for (const o of overrides) {
      if (o.tenantId === tenantId) {
        overrideMap.set(o.menuItemId, o.price);
      }
    }

    // Build categories with their items
    const result = activeCategories.map((category) => {
      const categoryItems = items
        .filter((item) => item.categoryId === category._id)
        .sort((a, b) => {
          // Featured items first, then by sortOrder
          if (a.isFeatured !== b.isFeatured) {
            return a.isFeatured ? -1 : 1;
          }
          return a.sortOrder - b.sortOrder;
        })
        .map((item) => ({
          name: item.name,
          description: item.description,
          effectivePrice: overrideMap.get(item._id) ?? item.basePrice,
          isFeatured: item.isFeatured,
        }));

      return {
        name: category.name,
        items: categoryItems,
      };
    });

    // Filter out empty categories
    const nonEmptyCategories = result.filter((c) => c.items.length > 0);

    // Get tenant branding
    const tenantSettings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .first();

    return {
      locationName: location.name,
      brandName: tenantSettings?.brandName ?? "",
      brandLogoUrl: tenantSettings?.brandLogoUrl ?? "",
      primaryColor: tenantSettings?.primaryColor ?? "#7C3A12",
      categories: nonEmptyCategories,
    };
  },
});
