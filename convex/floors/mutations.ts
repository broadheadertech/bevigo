import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { Id } from "../_generated/dataModel";

const ALLOWED_ROLES: Array<"owner" | "manager"> = ["owner", "manager"];

export const createFloor = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    name: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const existing = await ctx.db
      .query("floors")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", args.locationId)
      )
      .collect();
    const nextSort = existing.reduce((m, f) => Math.max(m, f.sortOrder), 0) + 1;

    const floorId = await ctx.db.insert("floors", {
      tenantId: session.tenantId,
      locationId: args.locationId,
      name: args.name.trim() || `Floor ${nextSort}`,
      sortOrder: nextSort,
      width: args.width ?? 1200,
      height: args.height ?? 800,
      status: "active",
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "floor_created",
      "floors",
      floorId,
      { name: args.name }
    );

    return floorId;
  },
});

export const updateFloor = mutation({
  args: {
    token: v.string(),
    floorId: v.id("floors"),
    name: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    backgroundImageId: v.optional(v.id("_storage")),
    clearBackground: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);

    const floor = await ctx.db.get(args.floorId);
    if (!floor || floor.tenantId !== session.tenantId) {
      throw new Error("Floor not found");
    }
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.width !== undefined) updates.width = args.width;
    if (args.height !== undefined) updates.height = args.height;
    if (args.backgroundImageId !== undefined)
      updates.backgroundImageId = args.backgroundImageId;
    if (args.clearBackground) updates.backgroundImageId = undefined;

    await ctx.db.patch(args.floorId, updates);
  },
});

export const deleteFloor = mutation({
  args: { token: v.string(), floorId: v.id("floors") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);

    const floor = await ctx.db.get(args.floorId);
    if (!floor || floor.tenantId !== session.tenantId) {
      throw new Error("Floor not found");
    }

    // Detach tables from this floor (don't delete them)
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_floor", (q) => q.eq("floorId", floor._id))
      .collect();
    for (const t of tables) {
      await ctx.db.patch(t._id, {
        floorId: undefined,
        xPos: undefined,
        yPos: undefined,
        updatedAt: Date.now(),
      });
    }

    // Delete zones on this floor
    const zones = await ctx.db
      .query("tableZones")
      .withIndex("by_floor", (q) => q.eq("floorId", floor._id))
      .collect();
    for (const z of zones) {
      await ctx.db.delete(z._id);
    }

    await ctx.db.delete(args.floorId);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "floor_deleted",
      "floors",
      args.floorId,
      { name: floor.name }
    );
  },
});

export const placeTable = mutation({
  args: {
    token: v.string(),
    tableId: v.id("tables"),
    floorId: v.optional(v.id("floors")),
    xPos: v.optional(v.number()),
    yPos: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    shape: v.optional(v.union(v.literal("rectangle"), v.literal("circle"))),
    rotation: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);

    const table = await ctx.db.get(args.tableId);
    if (!table || table.tenantId !== session.tenantId) {
      throw new Error("Table not found");
    }
    if (args.floorId) {
      const floor = await ctx.db.get(args.floorId);
      if (!floor || floor.tenantId !== session.tenantId) {
        throw new Error("Floor not found");
      }
      if (floor.locationId !== table.locationId) {
        throw new Error("Floor and table belong to different locations");
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.floorId !== undefined) updates.floorId = args.floorId;
    if (args.xPos !== undefined) updates.xPos = args.xPos;
    if (args.yPos !== undefined) updates.yPos = args.yPos;
    if (args.width !== undefined) updates.width = args.width;
    if (args.height !== undefined) updates.height = args.height;
    if (args.shape !== undefined) updates.shape = args.shape;
    if (args.rotation !== undefined) updates.rotation = args.rotation;

    await ctx.db.patch(args.tableId, updates);
  },
});

export const removeTableFromFloor = mutation({
  args: { token: v.string(), tableId: v.id("tables") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);
    const table = await ctx.db.get(args.tableId);
    if (!table || table.tenantId !== session.tenantId) {
      throw new Error("Table not found");
    }
    await ctx.db.patch(args.tableId, {
      floorId: undefined,
      xPos: undefined,
      yPos: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const createZone = mutation({
  args: {
    token: v.string(),
    floorId: v.id("floors"),
    name: v.string(),
    color: v.string(),
    xPos: v.number(),
    yPos: v.number(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);
    const floor = await ctx.db.get(args.floorId);
    if (!floor || floor.tenantId !== session.tenantId) {
      throw new Error("Floor not found");
    }
    return await ctx.db.insert("tableZones", {
      tenantId: session.tenantId,
      locationId: floor.locationId,
      floorId: args.floorId,
      name: args.name.trim() || "Zone",
      color: args.color,
      xPos: args.xPos,
      yPos: args.yPos,
      width: args.width,
      height: args.height,
      updatedAt: Date.now(),
    });
  },
});

export const updateZone = mutation({
  args: {
    token: v.string(),
    zoneId: v.id("tableZones"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    xPos: v.optional(v.number()),
    yPos: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    rotation: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone || zone.tenantId !== session.tenantId) {
      throw new Error("Zone not found");
    }
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.color !== undefined) updates.color = args.color;
    if (args.xPos !== undefined) updates.xPos = args.xPos;
    if (args.yPos !== undefined) updates.yPos = args.yPos;
    if (args.width !== undefined) updates.width = args.width;
    if (args.height !== undefined) updates.height = args.height;
    if (args.rotation !== undefined) updates.rotation = args.rotation;
    await ctx.db.patch(args.zoneId, updates);
  },
});

export const deleteZone = mutation({
  args: { token: v.string(), zoneId: v.id("tableZones") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone || zone.tenantId !== session.tenantId) {
      throw new Error("Zone not found");
    }
    await ctx.db.delete(args.zoneId);
  },
});

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ALLOWED_ROLES);
    return await ctx.storage.generateUploadUrl();
  },
});
