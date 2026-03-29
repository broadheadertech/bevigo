import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const createCategory = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const now = Date.now();
    const categoryId = await ctx.db.insert("categories", {
      tenantId: session.tenantId,
      name: args.name,
      sortOrder: args.sortOrder,
      status: "active",
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "category_created",
      "categories",
      categoryId,
      { name: args.name, sortOrder: args.sortOrder }
    );

    return categoryId;
  },
});

export const updateCategory = mutation({
  args: {
    token: v.string(),
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.tenantId !== session.tenantId) {
      throw new Error("Category not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.categoryId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "category_updated",
      "categories",
      args.categoryId,
      updates
    );

    return args.categoryId;
  },
});

export const reorderCategories = mutation({
  args: {
    token: v.string(),
    orderedIds: v.array(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const category = await ctx.db.get(args.orderedIds[i]);
      if (!category || category.tenantId !== session.tenantId) {
        throw new Error("Category not found or not owned by tenant");
      }
      await ctx.db.patch(args.orderedIds[i], {
        sortOrder: i,
        updatedAt: now,
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "categories_reordered",
      "categories",
      "bulk",
      { orderedIds: args.orderedIds }
    );
  },
});

export const createItem = mutation({
  args: {
    token: v.string(),
    categoryId: v.id("categories"),
    name: v.string(),
    description: v.optional(v.string()),
    basePrice: v.number(),
    isFeatured: v.optional(v.boolean()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Verify category belongs to tenant
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.tenantId !== session.tenantId) {
      throw new Error("Category not found");
    }

    const now = Date.now();
    const itemId = await ctx.db.insert("menuItems", {
      tenantId: session.tenantId,
      categoryId: args.categoryId,
      name: args.name,
      description: args.description,
      basePrice: args.basePrice,
      isFeatured: args.isFeatured ?? false,
      sortOrder: args.sortOrder,
      status: "active",
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "menu_item_created",
      "menuItems",
      itemId,
      {
        name: args.name,
        categoryId: args.categoryId,
        basePrice: args.basePrice,
      }
    );

    return itemId;
  },
});

export const updateItem = mutation({
  args: {
    token: v.string(),
    itemId: v.id("menuItems"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    basePrice: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    isFeatured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"))
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // If changing category, verify new category belongs to tenant
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.tenantId !== session.tenantId) {
        throw new Error("Category not found");
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.basePrice !== undefined) updates.basePrice = args.basePrice;
    if (args.categoryId !== undefined) updates.categoryId = args.categoryId;
    if (args.isFeatured !== undefined) updates.isFeatured = args.isFeatured;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.itemId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "menu_item_updated",
      "menuItems",
      args.itemId,
      updates
    );

    return args.itemId;
  },
});

export const deactivateItem = mutation({
  args: {
    token: v.string(),
    itemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    await ctx.db.patch(args.itemId, {
      status: "inactive",
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "menu_item_deactivated",
      "menuItems",
      args.itemId,
      { previousStatus: item.status, newStatus: "inactive" }
    );

    return args.itemId;
  },
});

export const reactivateItem = mutation({
  args: {
    token: v.string(),
    itemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    await ctx.db.patch(args.itemId, {
      status: "active",
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "menu_item_reactivated",
      "menuItems",
      args.itemId,
      { previousStatus: item.status, newStatus: "active" }
    );

    return args.itemId;
  },
});
