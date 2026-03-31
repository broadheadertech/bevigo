import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const listModifierGroups = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const groups = await ctx.db
      .query("modifierGroups")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const groupsWithModifiers = await Promise.all(
      groups.map(async (group) => {
        const modifiers = await ctx.db
          .query("modifiers")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        return {
          ...group,
          modifiers: modifiers.sort((a, b) => a.sortOrder - b.sortOrder),
        };
      })
    );

    return groupsWithModifiers.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getModifierGroup = query({
  args: {
    token: v.string(),
    groupId: v.id("modifierGroups"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const group = await ctx.db.get(args.groupId);
    if (!group || group.tenantId !== session.tenantId) {
      throw new Error("Modifier group not found");
    }

    const modifiers = await ctx.db
      .query("modifiers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    const assignments = await ctx.db
      .query("menuItemModifierGroups")
      .withIndex("by_modifier_group", (q) =>
        q.eq("modifierGroupId", args.groupId)
      )
      .collect();

    return {
      ...group,
      modifiers: modifiers.sort((a, b) => a.sortOrder - b.sortOrder),
      assignedItemCount: assignments.length,
    };
  },
});

export const getItemModifierGroups = query({
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

    const assignments = await ctx.db
      .query("menuItemModifierGroups")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.menuItemId))
      .collect();

    const groups = await Promise.all(
      assignments.map(async (a) => {
        const group = await ctx.db.get(a.modifierGroupId);
        if (!group) return null;

        const modifiers = await ctx.db
          .query("modifiers")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        return {
          ...group,
          modifiers: modifiers.sort((a, b) => a.sortOrder - b.sortOrder),
        };
      })
    );

    return groups
      .filter(Boolean)
      .sort((a, b) => a!.sortOrder - b!.sortOrder);
  },
});
