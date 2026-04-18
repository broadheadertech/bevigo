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
    isDefault: v.optional(v.boolean()),
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
    if (args.isDefault !== undefined) updates.isDefault = args.isDefault;

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

export const setAsDefault = mutation({
  args: {
    token: v.string(),
    modifierId: v.id("modifiers"),
    exclusive: v.optional(v.boolean()), // if true, clears defaults on siblings (single-select groups)
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const modifier = await ctx.db.get(args.modifierId);
    if (!modifier || modifier.tenantId !== session.tenantId) {
      throw new Error("Modifier not found");
    }

    if (args.exclusive) {
      const siblings = await ctx.db
        .query("modifiers")
        .withIndex("by_group", (q) => q.eq("groupId", modifier.groupId))
        .collect();
      for (const s of siblings) {
        if (s._id !== args.modifierId && s.isDefault) {
          await ctx.db.patch(s._id, {
            isDefault: false,
            updatedAt: Date.now(),
          });
        }
      }
    }

    await ctx.db.patch(args.modifierId, {
      isDefault: true,
      updatedAt: Date.now(),
    });
  },
});

export const clearDefault = mutation({
  args: { token: v.string(), modifierId: v.id("modifiers") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const modifier = await ctx.db.get(args.modifierId);
    if (!modifier || modifier.tenantId !== session.tenantId) {
      throw new Error("Modifier not found");
    }
    await ctx.db.patch(args.modifierId, {
      isDefault: false,
      updatedAt: Date.now(),
    });
  },
});

export const seedSampleModifiers = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const now = Date.now();
    const existing = await ctx.db
      .query("modifierGroups")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const existingNames = new Set(
      existing.map((g) => g.name.trim().toLowerCase())
    );
    let nextSort = existing.reduce((m, g) => Math.max(m, g.sortOrder), 0) + 1;

    const groupsToCreate: Array<{
      name: string;
      required: boolean;
      minSelect: number;
      maxSelect: number;
      options: Array<{
        name: string;
        priceAdjustment: number;
        isDefault?: boolean;
      }>;
    }> = [
      {
        name: "Espresso Shots",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "No espresso (decaf)", priceAdjustment: -3000 },
          { name: "Single shot", priceAdjustment: 0, isDefault: true },
          { name: "Extra shot", priceAdjustment: 3000 },
          { name: "Double extra", priceAdjustment: 6000 },
        ],
      },
      {
        name: "Milk Amount",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "Less milk", priceAdjustment: 0 },
          { name: "Normal", priceAdjustment: 0, isDefault: true },
          { name: "More milk", priceAdjustment: 1000 },
        ],
      },
      {
        name: "Sugar Level",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "0% (no sugar)", priceAdjustment: 0 },
          { name: "25%", priceAdjustment: 0 },
          { name: "50%", priceAdjustment: 0, isDefault: true },
          { name: "75%", priceAdjustment: 0 },
          { name: "100%", priceAdjustment: 0 },
        ],
      },
      {
        name: "Milk Type",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "Whole", priceAdjustment: 0, isDefault: true },
          { name: "Skim", priceAdjustment: 0 },
          { name: "Oat", priceAdjustment: 2000 },
          { name: "Almond", priceAdjustment: 2000 },
        ],
      },
      {
        name: "Add-ons",
        required: false,
        minSelect: 0,
        maxSelect: 3,
        options: [
          { name: "Whipped cream", priceAdjustment: 1500 },
          { name: "Caramel drizzle", priceAdjustment: 1500 },
          { name: "Chocolate syrup", priceAdjustment: 1500 },
        ],
      },
    ];

    let groupsCreated = 0;
    let optionsCreated = 0;

    for (const g of groupsToCreate) {
      if (existingNames.has(g.name.toLowerCase())) continue;

      const groupId = await ctx.db.insert("modifierGroups", {
        tenantId: session.tenantId,
        name: g.name,
        required: g.required,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        sortOrder: nextSort++,
        updatedAt: now,
      });
      groupsCreated++;

      let optSort = 0;
      for (const opt of g.options) {
        await ctx.db.insert("modifiers", {
          tenantId: session.tenantId,
          groupId,
          name: opt.name,
          priceAdjustment: opt.priceAdjustment,
          sortOrder: optSort++,
          status: "active",
          isDefault: opt.isDefault ?? false,
          updatedAt: now,
        });
        optionsCreated++;
      }
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "modifiers_seeded",
      "modifierGroups",
      "bulk",
      { groupsCreated, optionsCreated }
    );

    return { groupsCreated, optionsCreated };
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
