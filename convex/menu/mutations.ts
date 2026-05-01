import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { generateUniqueSku } from "./skuHelpers";

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

/**
 * Hard-delete a category — refuses if any product (active, inactive, or
 * archived) is still in it. Move products to a different category first
 * if you really need to remove this one.
 */
export const deleteCategory = mutation({
  args: {
    token: v.string(),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.tenantId !== session.tenantId) {
      throw new Error("Category not found");
    }

    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant_category", (q) =>
        q.eq("tenantId", session.tenantId).eq("categoryId", args.categoryId)
      )
      .collect();

    if (items.length > 0) {
      throw new Error(
        `Cannot delete "${category.name}" — still has ${items.length} product(s). Move or delete them first.`
      );
    }

    await ctx.db.delete(args.categoryId);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "category_deleted",
      "categories",
      args.categoryId,
      { name: category.name }
    );

    return args.categoryId;
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
    sku: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    sortOrder: v.number(),
    defaultSupplierId: v.optional(v.id("suppliers")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Verify category belongs to tenant
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.tenantId !== session.tenantId) {
      throw new Error("Category not found");
    }

    // Resolve SKU: honor explicit value (and fail on duplicate), otherwise
    // auto-generate from the product name and ensure uniqueness.
    let sku = args.sku?.trim() || undefined;
    if (sku) {
      const existing = await ctx.db
        .query("menuItems")
        .withIndex("by_tenant_sku", (q) =>
          q.eq("tenantId", session.tenantId).eq("sku", sku!)
        )
        .first();
      if (existing) {
        throw new Error(`SKU already exists: ${sku}`);
      }
    } else {
      const allItems = await ctx.db
        .query("menuItems")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .collect();
      const used = new Set<string>();
      for (const it of allItems) {
        if (it.sku) used.add(it.sku);
      }
      sku = generateUniqueSku(args.name, used, category.name);
    }

    if (args.defaultSupplierId) {
      const sup = await ctx.db.get(args.defaultSupplierId);
      if (!sup || sup.tenantId !== session.tenantId) {
        throw new Error("Supplier not found");
      }
    }

    const now = Date.now();
    const itemId = await ctx.db.insert("menuItems", {
      tenantId: session.tenantId,
      categoryId: args.categoryId,
      name: args.name,
      description: args.description,
      basePrice: args.basePrice,
      sku,
      isFeatured: args.isFeatured ?? false,
      sortOrder: args.sortOrder,
      defaultSupplierId: args.defaultSupplierId,
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
        sku,
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
    sku: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    isFeatured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"))
    ),
    /** Pass an Id to set, omit to leave unchanged. Pass clearSupplier:true to detach. */
    defaultSupplierId: v.optional(v.id("suppliers")),
    clearSupplier: v.optional(v.boolean()),
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
    if (args.sku !== undefined) updates.sku = args.sku;
    if (args.isFeatured !== undefined) updates.isFeatured = args.isFeatured;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;
    if (args.status !== undefined) updates.status = args.status;
    if (args.clearSupplier) {
      updates.defaultSupplierId = undefined;
    } else if (args.defaultSupplierId !== undefined) {
      const sup = await ctx.db.get(args.defaultSupplierId);
      if (!sup || sup.tenantId !== session.tenantId) {
        throw new Error("Supplier not found");
      }
      updates.defaultSupplierId = args.defaultSupplierId;
    }

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

/**
 * Hard-delete a menu item — refuses if anything still references it.
 * Use deactivateItem for the soft-delete (reversible) path.
 */
export const deleteItem = mutation({
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

    // Referential integrity checks — block deletion if any of these exist.
    const recipeLinks = await ctx.db
      .query("recipes")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.itemId))
      .collect();
    const modifierLinks = await ctx.db
      .query("menuItemModifierGroups")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.itemId))
      .collect();
    const overrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.itemId))
      .collect();
    // orderItems has no by_menu_item index — scan tenant and filter.
    const orderRefs = await ctx.db
      .query("orderItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .filter((q) => q.eq(q.field("menuItemId"), args.itemId))
      .collect();

    const blockers: string[] = [];
    if (orderRefs.length > 0) blockers.push(`${orderRefs.length} past order line(s)`);
    if (recipeLinks.length > 0) blockers.push(`${recipeLinks.length} recipe ingredient(s)`);
    if (modifierLinks.length > 0) blockers.push(`${modifierLinks.length} modifier group link(s)`);
    if (overrides.length > 0) blockers.push(`${overrides.length} price override(s)`);

    if (blockers.length > 0) {
      throw new Error(
        `Cannot delete "${item.name}" — still referenced by: ${blockers.join(", ")}. Deactivate it instead.`
      );
    }

    await ctx.db.delete(args.itemId);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "menu_item_deleted",
      "menuItems",
      args.itemId,
      { name: item.name }
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

export const toggleFeatured = mutation({
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

    const newFeatured = !item.isFeatured;

    await ctx.db.patch(args.itemId, {
      isFeatured: newFeatured,
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      newFeatured ? "menu_item_featured" : "menu_item_unfeatured",
      "menuItems",
      args.itemId,
      { previousIsFeatured: item.isFeatured, newIsFeatured: newFeatured }
    );

    return args.itemId;
  },
});
