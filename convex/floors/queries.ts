import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { Id } from "../_generated/dataModel";

export const listFloors = query({
  args: { token: v.string(), locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const floors = await ctx.db
      .query("floors")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", args.locationId)
      )
      .collect();

    const enriched = await Promise.all(
      floors
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(async (f) => ({
          _id: f._id,
          name: f.name,
          width: f.width,
          height: f.height,
          sortOrder: f.sortOrder,
          status: f.status,
          backgroundUrl: f.backgroundImageId
            ? await ctx.storage.getUrl(f.backgroundImageId)
            : null,
        }))
    );

    return enriched;
  },
});

export const getFloorPlan = query({
  args: { token: v.string(), floorId: v.id("floors") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const floor = await ctx.db.get(args.floorId);
    if (!floor || floor.tenantId !== session.tenantId) {
      throw new Error("Floor not found");
    }

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_floor", (q) => q.eq("floorId", floor._id))
      .collect();

    const zones = await ctx.db
      .query("tableZones")
      .withIndex("by_floor", (q) => q.eq("floorId", floor._id))
      .collect();

    // Pull active draft orders so the canvas can show occupancy
    const draftOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location_status", (q) =>
        q
          .eq("tenantId", session.tenantId)
          .eq("locationId", floor.locationId)
          .eq("status", "draft")
      )
      .collect();
    const occupiedTableIds = new Set(
      draftOrders.map((o) => o.tableId).filter(Boolean) as Id<"tables">[]
    );

    return {
      floor: {
        _id: floor._id,
        name: floor.name,
        width: floor.width,
        height: floor.height,
        backgroundUrl: floor.backgroundImageId
          ? await ctx.storage.getUrl(floor.backgroundImageId)
          : null,
      },
      tables: tables
        .filter((t) => t.status === "active")
        .map((t) => ({
          _id: t._id,
          name: t.name,
          capacity: t.capacity,
          shape: t.shape ?? "rectangle",
          xPos: t.xPos ?? 0,
          yPos: t.yPos ?? 0,
          width: t.width ?? 80,
          height: t.height ?? 80,
          rotation: t.rotation ?? 0,
          occupied: occupiedTableIds.has(t._id),
        })),
      zones: zones.map((z) => ({
        _id: z._id,
        name: z.name,
        color: z.color,
        xPos: z.xPos,
        yPos: z.yPos,
        width: z.width,
        height: z.height,
        rotation: z.rotation ?? 0,
      })),
    };
  },
});

/** Tables for this location not assigned to any floor yet — for the unpositioned tray. */
export const listUnpositionedTables = query({
  args: { token: v.string(), locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", args.locationId)
      )
      .collect();

    return tables
      .filter((t) => t.status === "active" && !t.floorId)
      .map((t) => ({
        _id: t._id,
        name: t.name,
        capacity: t.capacity,
        shape: t.shape ?? "rectangle",
      }));
  },
});
