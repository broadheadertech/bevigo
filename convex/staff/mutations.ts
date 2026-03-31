import { action, mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import bcrypt from "bcryptjs";

// Action because bcrypt is async and CPU-intensive
export const create = action({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("manager"), v.literal("barista")),
    locationIds: v.array(v.id("locations")),
    quickPin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Hash PIN outside of the mutation (bcrypt is async)
    let quickPinHash: string | undefined;
    if (args.quickPin) {
      if (args.quickPin.length < 4 || args.quickPin.length > 6) {
        throw new Error("Quick-PIN must be 4-6 digits");
      }
      if (!/^\d+$/.test(args.quickPin)) {
        throw new Error("Quick-PIN must contain only digits");
      }
      quickPinHash = await bcrypt.hash(args.quickPin, 12);
    }

    // Run the actual DB insert as an internal mutation
    const userId = await ctx.runMutation(
      internal.staff.internals.insertStaff,
      {
        token: args.token,
        name: args.name,
        email: args.email,
        role: args.role,
        locationIds: args.locationIds,
        quickPinHash,
      }
    );

    return userId;
  },
});

// Action because bcrypt is async
export const resetPin = action({
  args: {
    token: v.string(),
    userId: v.id("users"),
    newPin: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPin.length < 4 || args.newPin.length > 6) {
      throw new Error("Quick-PIN must be 4-6 digits");
    }
    if (!/^\d+$/.test(args.newPin)) {
      throw new Error("Quick-PIN must contain only digits");
    }

    const quickPinHash = await bcrypt.hash(args.newPin, 12);

    await ctx.runMutation(internal.staff.internals.updatePinHash, {
      token: args.token,
      userId: args.userId,
      quickPinHash,
    });
  },
});

// Regular mutation for non-PIN updates
export const update = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("owner"), v.literal("manager"), v.literal("barista"))),
    locationIds: v.optional(v.array(v.id("locations"))),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser || targetUser.tenantId !== session.tenantId) {
      throw new Error("User not found");
    }

    // Manager can only update baristas at own locations
    if (session.role === "manager") {
      if (targetUser.role !== "barista") {
        throw new Error("Managers can only edit barista accounts");
      }
      if (args.role && args.role !== "barista") {
        throw new Error("Managers can only assign barista role");
      }

      // Verify manager has access to at least one of the target user's locations
      const targetAssignments = await ctx.db
        .query("userLocations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      const hasOverlap = targetAssignments.some((ul) =>
        session.locationIds.includes(ul.locationId)
      );
      if (!hasOverlap) {
        throw new Error("Not authorized to edit this staff member");
      }

      // Manager can only assign to own locations
      if (args.locationIds) {
        for (const locationId of args.locationIds) {
          requireLocationAccess(session, locationId);
        }
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.role !== undefined) updates.role = args.role;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.userId, updates);

    // Update location assignments if provided
    if (args.locationIds !== undefined) {
      // Remove existing assignments
      const existing = await ctx.db
        .query("userLocations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const ul of existing) {
        await ctx.db.delete(ul._id);
      }
      // Create new assignments
      for (const locationId of args.locationIds) {
        await ctx.db.insert("userLocations", {
          userId: args.userId,
          locationId,
          tenantId: session.tenantId,
        });
      }
    }

    // Audit log
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "staff_updated",
      "users",
      args.userId,
      updates
    );

    return args.userId;
  },
});

// Manager-scoped barista creation (Story 1.3)
export const createByManager = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    locationId: v.id("locations"),
    quickPinHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);

    // Manager can only create baristas at their own location
    requireLocationAccess(session, args.locationId);

    // Verify location belongs to this tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    // If email provided, check for uniqueness within tenant
    if (args.email) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_tenant_email", (q) =>
          q.eq("tenantId", session.tenantId).eq("email", args.email!)
        )
        .unique();

      if (existingUser) {
        throw new Error("A staff member with this email already exists");
      }
    }

    // If PIN provided, check for uniqueness within this location
    if (args.quickPinHash) {
      const locationStaff = await ctx.db
        .query("userLocations")
        .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
        .collect();

      for (const assignment of locationStaff) {
        const user = await ctx.db.get(assignment.userId);
        if (user && user.quickPinHash === args.quickPinHash) {
          throw new Error(
            "This PIN is already in use at this location. Each staff member must have a unique PIN per location."
          );
        }
      }
    }

    const now = Date.now();

    // Create the user -- managers can only create baristas
    const userId = await ctx.db.insert("users", {
      tenantId: session.tenantId,
      name: args.name,
      email: args.email,
      role: "barista",
      quickPinHash: args.quickPinHash,
      status: "active",
      updatedAt: now,
    });

    // Create the location assignment
    await ctx.db.insert("userLocations", {
      userId,
      locationId: args.locationId,
      tenantId: session.tenantId,
    });

    // Audit log
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "staff_created_by_manager",
      "users",
      userId,
      {
        name: args.name,
        role: "barista",
        locationId: args.locationId,
        locationName: location.name,
        createdBy: session.userId,
        createdByRole: session.role,
      }
    );

    return userId;
  },
});

// Manager-scoped barista update (Story 1.3)
export const updateByManager = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"))
    ),
    quickPinHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);

    // Validate the target user belongs to this tenant
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser || targetUser.tenantId !== session.tenantId) {
      throw new Error("User not found");
    }

    // Managers can only edit baristas, not other managers or owners
    if (session.role === "manager" && targetUser.role !== "barista") {
      throw new Error("Managers can only edit barista accounts");
    }

    // Verify the manager has access to at least one location the target is assigned to
    const targetAssignments = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const targetLocationIds = targetAssignments
      .filter((ul) => ul.tenantId === session.tenantId)
      .map((ul) => ul.locationId);

    if (session.role === "manager") {
      const hasOverlap = targetLocationIds.some((locId) =>
        session.locationIds.includes(locId)
      );
      if (!hasOverlap) {
        throw new Error("Not authorized to edit this staff member");
      }
    }

    // If PIN is being updated, validate uniqueness at all assigned locations
    if (args.quickPinHash) {
      for (const locationId of targetLocationIds) {
        const locationStaff = await ctx.db
          .query("userLocations")
          .withIndex("by_location", (q) => q.eq("locationId", locationId))
          .collect();

        for (const assignment of locationStaff) {
          if (assignment.userId === args.userId) continue; // skip self
          const user = await ctx.db.get(assignment.userId);
          if (user && user.quickPinHash === args.quickPinHash) {
            const loc = await ctx.db.get(locationId);
            throw new Error(
              `This PIN is already in use at ${loc?.name ?? "a location"}. Each staff member must have a unique PIN per location.`
            );
          }
        }
      }
    }

    // Build the patch
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (args.name !== undefined && args.name !== targetUser.name) {
      patch.name = args.name;
      changes.name = { from: targetUser.name, to: args.name };
    }
    if (args.status !== undefined && args.status !== targetUser.status) {
      patch.status = args.status;
      changes.status = { from: targetUser.status, to: args.status };
    }
    if (args.quickPinHash !== undefined) {
      patch.quickPinHash = args.quickPinHash;
      changes.quickPinHash = { from: "[redacted]", to: "[redacted]" };
    }

    if (Object.keys(changes).length === 0) {
      return; // No changes to apply
    }

    await ctx.db.patch(args.userId, patch);

    // Audit log
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "staff_updated_by_manager",
      "users",
      args.userId,
      {
        targetUserName: targetUser.name,
        changes,
        updatedBy: session.userId,
        updatedByRole: session.role,
      }
    );
  },
});
