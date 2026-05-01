import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    suppliers.sort((a, b) => a.name.localeCompare(b.name));
    return suppliers;
  },
});

export const get = query({
  args: { token: v.string(), supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.tenantId !== session.tenantId) return null;

    // Count what references this supplier so the UI can show usage at a glance.
    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_supplier", (q) => q.eq("defaultSupplierId", args.supplierId))
      .collect();
    const menuItems = await ctx.db
      .query("menuItems")
      .withIndex("by_supplier", (q) => q.eq("defaultSupplierId", args.supplierId))
      .collect();

    return {
      ...supplier,
      ingredientCount: ingredients.length,
      menuItemCount: menuItems.length,
    };
  },
});
