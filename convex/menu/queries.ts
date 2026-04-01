import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";

export const listCategories = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant_sort", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    return categories;
  },
});

export const listItems = query({
  args: {
    token: v.string(),
    categoryId: v.optional(v.id("categories")),
    status: v.optional(
      v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"))
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    let items;

    if (args.categoryId) {
      items = await ctx.db
        .query("menuItems")
        .withIndex("by_tenant_category", (q) =>
          q.eq("tenantId", session.tenantId).eq("categoryId", args.categoryId!)
        )
        .collect();
    } else {
      items = await ctx.db
        .query("menuItems")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .collect();
    }

    if (args.status) {
      items = items.filter((item) => item.status === args.status);
    }

    return items;
  },
});

export const getItem = query({
  args: {
    token: v.string(),
    itemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Get modifier group assignments
    const assignments = await ctx.db
      .query("menuItemModifierGroups")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.itemId))
      .collect();

    const modifierGroups = await Promise.all(
      assignments.map(async (a) => {
        const group = await ctx.db.get(a.modifierGroupId);
        return group
          ? { _id: group._id, name: group.name, required: group.required }
          : null;
      })
    );

    return {
      ...item,
      modifierGroups: modifierGroups.filter(Boolean),
    };
  },
});

export const listFeatured = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant_featured", (q) =>
        q.eq("tenantId", session.tenantId).eq("isFeatured", true)
      )
      .collect();

    return items;
  },
});

export const listItemsForLocation = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);
    requireLocationAccess(session, args.locationId);

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

    const results = [];
    for (const item of items) {
      const overridePrice = overrideMap.get(item._id);
      const imageUrl = item.imageId ? await ctx.storage.getUrl(item.imageId) : null;
      results.push({
        _id: item._id,
        name: item.name,
        description: item.description,
        categoryId: item.categoryId,
        basePrice: item.basePrice,
        effectivePrice: overridePrice ?? item.basePrice,
        hasOverride: overridePrice !== undefined,
        isFeatured: item.isFeatured,
        imageUrl,
        sku: item.sku,
      });
    }
    return results;
  },
});

export const findItemBySku = query({
  args: {
    token: v.string(),
    sku: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const item = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant_sku", (q) =>
        q.eq("tenantId", session.tenantId).eq("sku", args.sku)
      )
      .unique();

    if (!item || item.status !== "active") {
      return null;
    }

    // Check for location price override
    const override = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", item._id).eq("locationId", args.locationId)
      )
      .unique();

    const effectivePrice = override ? override.price : item.basePrice;

    return {
      _id: item._id,
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      basePrice: item.basePrice,
      effectivePrice,
      hasOverride: override !== null && override !== undefined,
      isFeatured: item.isFeatured,
      sku: item.sku,
    };
  },
});
