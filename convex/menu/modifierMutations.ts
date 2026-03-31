import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const createModifierGroup = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    required: v.boolean(),
    minSelect: v.number(),
    maxSelect: v.number(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const now = Date.now();
    const groupId = await ctx.db.insert("modifierGroups", {
      tenantId: session.tenantId,
      name: args.name,
      required: args.required,
      minSelect: args.minSelect,
      maxSelect: args.maxSelect,
      sortOrder: args.sortOrder,
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "modifier_group_created",
      "modifierGroups",
      groupId,
      {
        name: args.name,
        required: args.required,
        minSelect: args.minSelect,
        maxSelect: args.maxSelect,
      }
    );

    return groupId;
  },
});

export const updateModifierGroup = mutation({
  args: {
    token: v.string(),
    groupId: v.id("modifierGroups"),
    name: v.optional(v.string()),
    required: v.optional(v.boolean()),
    minSelect: v.optional(v.number()),
    maxSelect: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const group = await ctx.db.get(args.groupId);
    if (!group || group.tenantId !== session.tenantId) {
      throw new Error("Modifier group not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.required !== undefined) updates.required = args.required;
    if (args.minSelect !== undefined) updates.minSelect = args.minSelect;
    if (args.maxSelect !== undefined) updates.maxSelect = args.maxSelect;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;

    await ctx.db.patch(args.groupId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "modifier_group_updated",
      "modifierGroups",
      args.groupId,
      updates
    );

    return args.groupId;
  },
});

export const addModifier = mutation({
  args: {
    token: v.string(),
    groupId: v.id("modifierGroups"),
    name: v.string(),
    priceAdjustment: v.number(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const group = await ctx.db.get(args.groupId);
    if (!group || group.tenantId !== session.tenantId) {
      throw new Error("Modifier group not found");
    }

    const now = Date.now();
    const modifierId = await ctx.db.insert("modifiers", {
      tenantId: session.tenantId,
      groupId: args.groupId,
      name: args.name,
      priceAdjustment: args.priceAdjustment,
      sortOrder: args.sortOrder,
      status: "active",
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "modifier_created",
      "modifiers",
      modifierId,
      {
        groupId: args.groupId,
        name: args.name,
        priceAdjustment: args.priceAdjustment,
      }
    );

    return modifierId;
  },
});

export const updateModifier = mutation({
  args: {
    token: v.string(),
    modifierId: v.id("modifiers"),
    name: v.optional(v.string()),
    priceAdjustment: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const modifier = await ctx.db.get(args.modifierId);
    if (!modifier || modifier.tenantId !== session.tenantId) {
      throw new Error("Modifier not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.priceAdjustment !== undefined)
      updates.priceAdjustment = args.priceAdjustment;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.modifierId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "modifier_updated",
      "modifiers",
      args.modifierId,
      updates
    );

    return args.modifierId;
  },
});

export const assignToItem = mutation({
  args: {
    token: v.string(),
    menuItemId: v.id("menuItems"),
    modifierGroupId: v.id("modifierGroups"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const item = await ctx.db.get(args.menuItemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    const group = await ctx.db.get(args.modifierGroupId);
    if (!group || group.tenantId !== session.tenantId) {
      throw new Error("Modifier group not found");
    }

    // Check if already assigned
    const existing = await ctx.db
      .query("menuItemModifierGroups")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.menuItemId))
      .collect();

    const alreadyAssigned = existing.some(
      (a) => a.modifierGroupId === args.modifierGroupId
    );
    if (alreadyAssigned) {
      throw new Error("Modifier group already assigned to this item");
    }

    const linkId = await ctx.db.insert("menuItemModifierGroups", {
      menuItemId: args.menuItemId,
      modifierGroupId: args.modifierGroupId,
      tenantId: session.tenantId,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "modifier_group_assigned",
      "menuItemModifierGroups",
      linkId,
      {
        menuItemId: args.menuItemId,
        modifierGroupId: args.modifierGroupId,
      }
    );

    return linkId;
  },
});

export const removeFromItem = mutation({
  args: {
    token: v.string(),
    menuItemId: v.id("menuItems"),
    modifierGroupId: v.id("modifierGroups"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const item = await ctx.db.get(args.menuItemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    const assignments = await ctx.db
      .query("menuItemModifierGroups")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.menuItemId))
      .collect();

    const link = assignments.find(
      (a) => a.modifierGroupId === args.modifierGroupId
    );
    if (!link) {
      throw new Error("Assignment not found");
    }

    await ctx.db.delete(link._id);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "modifier_group_unassigned",
      "menuItemModifierGroups",
      link._id,
      {
        menuItemId: args.menuItemId,
        modifierGroupId: args.modifierGroupId,
      }
    );
  },
});
