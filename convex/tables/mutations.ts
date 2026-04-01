import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const createTable = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    name: v.string(),
    zone: v.optional(v.string()),
    capacity: v.number(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner"]);

    // Validate location belongs to tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== auth.tenantId) {
      throw new Error("Location not found");
    }

    const tableId = await ctx.db.insert("tables", {
      tenantId: auth.tenantId,
      locationId: args.locationId,
      name: args.name,
      zone: args.zone,
      capacity: args.capacity,
      sortOrder: args.sortOrder,
      status: "active",
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      auth.tenantId,
      auth.userId,
      "table.created",
      "tables",
      tableId,
      { name: args.name, zone: args.zone, capacity: args.capacity }
    );

    return tableId;
  },
});

export const updateTable = mutation({
  args: {
    token: v.string(),
    tableId: v.id("tables"),
    name: v.optional(v.string()),
    zone: v.optional(v.string()),
    capacity: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner"]);

    const table = await ctx.db.get(args.tableId);
    if (!table || table.tenantId !== auth.tenantId) {
      throw new Error("Table not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.zone !== undefined) updates.zone = args.zone;
    if (args.capacity !== undefined) updates.capacity = args.capacity;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.tableId, updates);

    await logAuditEntry(
      ctx,
      auth.tenantId,
      auth.userId,
      "table.updated",
      "tables",
      args.tableId,
      updates
    );

    return args.tableId;
  },
});

export const deleteTable = mutation({
  args: {
    token: v.string(),
    tableId: v.id("tables"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner"]);

    const table = await ctx.db.get(args.tableId);
    if (!table || table.tenantId !== auth.tenantId) {
      throw new Error("Table not found");
    }

    // Check for active draft orders on this table
    const draftOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location_status", (q: any) =>
        q
          .eq("tenantId", auth.tenantId)
          .eq("locationId", table.locationId)
          .eq("status", "draft")
      )
      .collect();

    const hasActiveOrder = draftOrders.some(
      (order: typeof draftOrders[number]) => order.tableId === args.tableId
    );

    if (hasActiveOrder) {
      throw new Error("Cannot delete a table with an active order");
    }

    await ctx.db.delete(args.tableId);

    await logAuditEntry(
      ctx,
      auth.tenantId,
      auth.userId,
      "table.deleted",
      "tables",
      args.tableId,
      { name: table.name }
    );

    return args.tableId;
  },
});
