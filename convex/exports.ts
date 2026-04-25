import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "./lib/auth";

/**
 * Export queries return rows already shaped for a CSV writer on the client.
 *
 * They intentionally return strings/numbers (not Convex IDs) so the client
 * can serialize without extra lookups. Owner/manager only — these dumps can
 * include cost/price data that baristas shouldn't necessarily see in bulk.
 */

export const exportMenu = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant_sort", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const catName = new Map(categories.map((c) => [c._id, c.name]));

    return items
      .map((it) => ({
        sku: it.sku ?? "",
        name: it.name,
        category: catName.get(it.categoryId) ?? "",
        basePrice: (it.basePrice / 100).toFixed(2),
        isFeatured: it.isFeatured ? "yes" : "no",
        status: it.status,
        description: it.description ?? "",
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku));
  },
});

export const exportIngredients = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    return ingredients
      .map((ing) => ({
        sku: ing.sku ?? "",
        name: ing.name,
        category: ing.category ?? "",
        unit: ing.unit,
        reorderThreshold: ing.reorderThreshold,
        status: ing.status,
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku));
  },
});

/**
 * Inventory snapshot — ingredients with their per-location stock totals.
 * Returns one row per (ingredient, location) pair so the operator can see
 * exactly what's on hand where.
 */
export const exportInventory = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    const locName = new Map(locations.map((l) => [l._id, l.name]));

    const rows: Array<{
      sku: string;
      ingredient: string;
      category: string;
      unit: string;
      location: string;
      quantity: number;
      reorderThreshold: number;
      belowThreshold: string;
      status: string;
    }> = [];

    for (const ing of ingredients) {
      const stock = await ctx.db
        .query("ingredientStock")
        .withIndex("by_ingredient", (q) => q.eq("ingredientId", ing._id))
        .collect();
      if (stock.length === 0) {
        rows.push({
          sku: ing.sku ?? "",
          ingredient: ing.name,
          category: ing.category ?? "",
          unit: ing.unit,
          location: "—",
          quantity: 0,
          reorderThreshold: ing.reorderThreshold,
          belowThreshold: "yes",
          status: ing.status,
        });
        continue;
      }
      for (const s of stock) {
        rows.push({
          sku: ing.sku ?? "",
          ingredient: ing.name,
          category: ing.category ?? "",
          unit: ing.unit,
          location: locName.get(s.locationId) ?? "Unknown",
          quantity: s.quantity,
          reorderThreshold: ing.reorderThreshold,
          belowThreshold: s.quantity < ing.reorderThreshold ? "yes" : "no",
          status: ing.status,
        });
      }
    }

    rows.sort(
      (a, b) =>
        a.sku.localeCompare(b.sku) || a.location.localeCompare(b.location)
    );
    return rows;
  },
});

export const exportCustomers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    return customers
      .map((c) => ({
        customerNumber: c.customerNumber ?? "",
        name: c.name,
        phone: c.phone ?? "",
        email: c.email ?? "",
        visitCount: c.visitCount,
        totalSpent: (c.totalSpent / 100).toFixed(2),
        pointsBalance: c.pointsBalance ?? 0,
        lastVisitAt: c.lastVisitAt
          ? new Date(c.lastVisitAt).toISOString()
          : "",
        status: c.status,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
