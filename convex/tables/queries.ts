import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const listTables = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner", "manager", "barista"]);

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_tenant_location", (q: any) =>
        q.eq("tenantId", auth.tenantId).eq("locationId", args.locationId)
      )
      .collect();

    // Get all draft orders for this location once
    const draftOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location_status", (q: any) =>
        q
          .eq("tenantId", auth.tenantId)
          .eq("locationId", args.locationId)
          .eq("status", "draft")
      )
      .collect();

    return tables.map((table: typeof tables[number]) => {
      const assignedOrder = draftOrders.find(
        (order: typeof draftOrders[number]) => order.tableId === table._id
      );

      return {
        ...table,
        occupied: !!assignedOrder,
        orderId: assignedOrder?._id ?? null,
      };
    });
  },
});

export const getTableStatus = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner", "manager", "barista"]);

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_tenant_location", (q: any) =>
        q.eq("tenantId", auth.tenantId).eq("locationId", args.locationId)
      )
      .collect();

    // Get all draft orders for this location
    const draftOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location_status", (q: any) =>
        q
          .eq("tenantId", auth.tenantId)
          .eq("locationId", args.locationId)
          .eq("status", "draft")
      )
      .collect();

    // Get item counts for draft orders with tables
    const orderItemCounts: Record<string, number> = {};
    for (const order of draftOrders) {
      if (order.tableId) {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q: any) => q.eq("orderId", order._id))
          .collect();
        orderItemCounts[order._id] = items.length;
      }
    }

    return tables.map((table: typeof tables[number]) => {
      const assignedOrder = draftOrders.find(
        (order: typeof draftOrders[number]) => order.tableId === table._id
      );

      return {
        tableId: table._id,
        tableName: table.name,
        zone: table.zone,
        capacity: table.capacity,
        status: assignedOrder ? ("occupied" as const) : ("available" as const),
        orderId: assignedOrder?._id,
        orderTotal: assignedOrder?.total,
        orderItemCount: assignedOrder
          ? orderItemCounts[assignedOrder._id] ?? 0
          : undefined,
      };
    });
  },
});
