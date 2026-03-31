import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const insertStaff = internalMutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("manager"), v.literal("barista")),
    locationIds: v.array(v.id("locations")),
    quickPinHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    // Manager can only create baristas
    if (session.role === "manager" && args.role !== "barista") {
      throw new Error("Managers can only create barista accounts");
    }

    // Manager can only assign to own locations
    if (session.role === "manager") {
      for (const locId of args.locationIds) {
        if (!session.locationIds.some((sid) => sid === locId)) {
          throw new Error("Cannot assign staff to locations outside your access");
        }
      }
    }

    // Verify all locationIds belong to tenant
    for (const locId of args.locationIds) {
      const location = await ctx.db.get(locId);
      if (!location || location.tenantId !== session.tenantId) {
        throw new Error("Invalid location");
      }
    }

    const userId = await ctx.db.insert("users", {
      tenantId: session.tenantId,
      name: args.name,
      email: args.email,
      googleId: undefined,
      role: args.role,
      quickPinHash: args.quickPinHash,
      status: "active",
      updatedAt: Date.now(),
    });

    // Create location assignments
    for (const locationId of args.locationIds) {
      await ctx.db.insert("userLocations", {
        userId,
        locationId,
        tenantId: session.tenantId,
      });
    }

    // Audit log
    await ctx.db.insert("auditLog", {
      tenantId: session.tenantId,
      userId: session.userId,
      action: "create",
      entityType: "user",
      entityId: userId.toString(),
      changes: { name: args.name, role: args.role, locationIds: args.locationIds },
    });

    return userId;
  },
});

export const updatePinHash = internalMutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    quickPinHash: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser || targetUser.tenantId !== session.tenantId) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, {
      quickPinHash: args.quickPinHash,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      tenantId: session.tenantId,
      userId: session.userId,
      action: "reset_pin",
      entityType: "user",
      entityId: args.userId.toString(),
      changes: { action: "pin_reset" },
    });
  },
});
