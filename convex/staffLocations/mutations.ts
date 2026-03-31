import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const assign = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Validate the target user belongs to this tenant
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser || targetUser.tenantId !== session.tenantId) {
      throw new ConvexError("User not found");
    }

    // Validate the location belongs to this tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new ConvexError("Location not found");
    }

    // Check for existing assignment to prevent duplicates
    const existing = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const alreadyAssigned = existing.some(
      (ul) => ul.locationId === args.locationId
    );
    if (alreadyAssigned) {
      throw new ConvexError("User is already assigned to this location");
    }

    // Create the assignment
    const assignmentId = await ctx.db.insert("userLocations", {
      userId: args.userId,
      locationId: args.locationId,
      tenantId: session.tenantId,
    });

    // Audit log
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "staff_location_assigned",
      "userLocations",
      assignmentId,
      {
        targetUserId: args.userId,
        targetUserName: targetUser.name,
        locationId: args.locationId,
        locationName: location.name,
      }
    );

    return assignmentId;
  },
});

export const unassign = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Validate the target user belongs to this tenant
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser || targetUser.tenantId !== session.tenantId) {
      throw new ConvexError("User not found");
    }

    // Find the assignment
    const assignments = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const assignment = assignments.find(
      (ul) => ul.locationId === args.locationId
    );
    if (!assignment) {
      throw new ConvexError("User is not assigned to this location");
    }

    // Validate assignment belongs to this tenant
    if (assignment.tenantId !== session.tenantId) {
      throw new ConvexError("Not authorized");
    }

    // Look up location name for audit
    const location = await ctx.db.get(args.locationId);

    // Delete the assignment
    await ctx.db.delete(assignment._id);

    // Audit log
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "staff_location_unassigned",
      "userLocations",
      assignment._id,
      {
        targetUserId: args.userId,
        targetUserName: targetUser.name,
        locationId: args.locationId,
        locationName: location?.name ?? "Unknown",
      }
    );
  },
});

export const bulkAssign = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    locationIds: v.array(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Validate the target user belongs to this tenant
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser || targetUser.tenantId !== session.tenantId) {
      throw new ConvexError("User not found");
    }

    // Validate all locations belong to this tenant
    for (const locationId of args.locationIds) {
      const location = await ctx.db.get(locationId);
      if (!location || location.tenantId !== session.tenantId) {
        throw new ConvexError(`Location ${locationId} not found`);
      }
    }

    // Get current assignments
    const currentAssignments = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter to only this tenant's assignments
    const tenantAssignments = currentAssignments.filter(
      (ul) => ul.tenantId === session.tenantId
    );

    const currentLocationIds = tenantAssignments.map((ul) => ul.locationId);
    const desiredLocationIds = args.locationIds;

    // Determine additions and removals
    const toAdd = desiredLocationIds.filter(
      (id) => !currentLocationIds.includes(id)
    );
    const toRemove = tenantAssignments.filter(
      (ul) => !desiredLocationIds.includes(ul.locationId)
    );

    // Remove old assignments
    for (const assignment of toRemove) {
      await ctx.db.delete(assignment._id);
    }

    // Add new assignments
    for (const locationId of toAdd) {
      await ctx.db.insert("userLocations", {
        userId: args.userId,
        locationId,
        tenantId: session.tenantId,
      });
    }

    // Audit log (single entry for bulk operation)
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "staff_location_bulk_assigned",
      "users",
      args.userId,
      {
        targetUserName: targetUser.name,
        previousLocationIds: currentLocationIds,
        newLocationIds: desiredLocationIds,
        added: toAdd,
        removed: toRemove.map((ul) => ul.locationId),
      }
    );
  },
});
