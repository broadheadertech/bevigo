import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";

export const getByUser = query({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Validate target user belongs to this tenant
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser || targetUser.tenantId !== session.tenantId) {
      return [];
    }

    // Managers can only see assignments for users at their own locations
    if (session.role === "manager") {
      const assignments = await ctx.db
        .query("userLocations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();

      // Filter to only locations the manager has access to
      const visibleAssignments = assignments.filter(
        (ul) =>
          ul.tenantId === session.tenantId &&
          session.locationIds.includes(ul.locationId)
      );

      // Enrich with location data
      const enriched = await Promise.all(
        visibleAssignments.map(async (ul) => {
          const location = await ctx.db.get(ul.locationId);
          return {
            _id: ul._id,
            locationId: ul.locationId,
            locationName: location?.name ?? "Unknown",
            locationStatus: location?.status ?? "inactive",
          };
        })
      );

      return enriched;
    }

    // Owner sees all assignments
    requireRole(session, ["owner"]);

    const assignments = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const tenantAssignments = assignments.filter(
      (ul) => ul.tenantId === session.tenantId
    );

    const enriched = await Promise.all(
      tenantAssignments.map(async (ul) => {
        const location = await ctx.db.get(ul.locationId);
        return {
          _id: ul._id,
          locationId: ul.locationId,
          locationName: location?.name ?? "Unknown",
          locationStatus: location?.status ?? "inactive",
        };
      })
    );

    return enriched;
  },
});

export const getByLocation = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);

    // Verify the location belongs to this tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      return [];
    }

    // Manager must have access to this location
    requireLocationAccess(session, args.locationId);

    const assignments = await ctx.db
      .query("userLocations")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    const tenantAssignments = assignments.filter(
      (ul) => ul.tenantId === session.tenantId
    );

    const enriched = await Promise.all(
      tenantAssignments.map(async (ul) => {
        const user = await ctx.db.get(ul.userId);
        return {
          _id: ul._id,
          userId: ul.userId,
          userName: user?.name ?? "Unknown",
          userRole: user?.role ?? "barista",
          userStatus: user?.status ?? "inactive",
          userEmail: user?.email ?? null,
        };
      })
    );

    return enriched;
  },
});

export const getAssignmentMatrix = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Get all active users for this tenant
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    // Get all active locations for this tenant
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    // Get all userLocations for this tenant
    const allAssignments = await ctx.db
      .query("userLocations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    // Build matrix: each user with their assigned location IDs
    const matrix = users.map((user) => {
      const userAssignments = allAssignments.filter(
        (ul) => ul.userId === user._id
      );
      return {
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        userEmail: user.email ?? null,
        assignedLocationIds: userAssignments.map((ul) => ul.locationId),
      };
    });

    return {
      users: matrix,
      locations: locations.map((loc) => ({
        locationId: loc._id,
        locationName: loc.name,
      })),
    };
  },
});
