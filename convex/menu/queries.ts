import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

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
