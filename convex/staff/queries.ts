import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";

export const list = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    // Fetch all users for tenant
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    // Fetch all userLocations for tenant
    const allUserLocations = await ctx.db
      .query("userLocations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    // Fetch all locations for tenant (for display names)
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const locationMap = new Map(locations.map((l) => [l._id.toString(), l]));

    // Build staff list with location info
    let staffList = users.map((user) => {
      const userLocs = allUserLocations
        .filter((ul) => ul.userId === user._id)
        .map((ul) => ({
          locationId: ul.locationId,
          locationName: locationMap.get(ul.locationId.toString())?.name || "Unknown",
        }));

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        locations: userLocs,
        updatedAt: user.updatedAt,
      };
    });

    // Manager scoping: only see staff at own locations
    if (session.role === "manager") {
      staffList = staffList.filter((staff) =>
        staff.locations.some((loc) =>
          session.locationIds.some((sid) => sid === loc.locationId)
        )
      );
    }

    // Optional location filter
    if (args.locationId) {
      requireLocationAccess(session, args.locationId);
      staffList = staffList.filter((staff) =>
        staff.locations.some((loc) => loc.locationId === args.locationId)
      );
    }

    return staffList;
  },
});

export const getById = query({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== session.tenantId) {
      throw new Error("User not found");
    }

    const userLocations = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Manager can only view staff at their own locations
    if (session.role === "manager") {
      const hasOverlap = userLocations.some((ul) =>
        session.locationIds.includes(ul.locationId)
      );
      if (!hasOverlap) {
        throw new Error("Not authorized to view this staff member");
      }
    }

    const locations = await Promise.all(
      userLocations.map(async (ul) => {
        const loc = await ctx.db.get(ul.locationId);
        return {
          locationId: ul.locationId,
          locationName: loc?.name || "Unknown",
        };
      })
    );

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      hasPin: !!user.quickPinHash,
      locations,
      updatedAt: user.updatedAt,
    };
  },
});

// Story 1.3: List staff by specific location
export const listByLocation = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);

    // Verify location belongs to this tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      return [];
    }

    // Manager must have access to this location
    requireLocationAccess(session, args.locationId);

    // Get all users assigned to this location
    const assignments = await ctx.db
      .query("userLocations")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    const tenantAssignments = assignments.filter(
      (ul) => ul.tenantId === session.tenantId
    );

    const staffList = await Promise.all(
      tenantAssignments.map(async (ul) => {
        const user = await ctx.db.get(ul.userId);
        if (!user) return null;

        // Get all locations this user is assigned to (for display)
        const allUserAssignments = await ctx.db
          .query("userLocations")
          .withIndex("by_user", (q) => q.eq("userId", ul.userId))
          .collect();

        const userLocations = await Promise.all(
          allUserAssignments
            .filter((a) => a.tenantId === session.tenantId)
            .map(async (a) => {
              const loc = await ctx.db.get(a.locationId);
              return {
                locationId: a.locationId,
                locationName: loc?.name ?? "Unknown",
              };
            })
        );

        return {
          _id: user._id,
          name: user.name,
          email: user.email ?? null,
          role: user.role,
          status: user.status,
          hasPin: !!user.quickPinHash,
          locations: userLocations,
          _creationTime: user._creationTime,
        };
      })
    );

    return staffList.filter(Boolean);
  },
});

// Story 1.3: List all staff with manager scoping
export const listAll = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);

    let users;

    if (session.role === "owner") {
      // Owner sees all staff in the tenant
      users = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .collect();
    } else {
      // Manager sees only staff at their location(s)
      const assignmentSets = await Promise.all(
        session.locationIds.map(async (locationId) => {
          return ctx.db
            .query("userLocations")
            .withIndex("by_location", (q) => q.eq("locationId", locationId))
            .collect();
        })
      );

      // Flatten and deduplicate by userId
      const allAssignments = assignmentSets.flat().filter(
        (ul) => ul.tenantId === session.tenantId
      );
      const uniqueUserIds = [
        ...new Set(allAssignments.map((ul) => ul.userId)),
      ];

      const userResults = await Promise.all(
        uniqueUserIds.map((id) => ctx.db.get(id))
      );
      users = userResults.filter(Boolean);
    }

    // Enrich each user with their location assignments
    const enriched = await Promise.all(
      users.map(async (user) => {
        if (!user) return null;

        const assignments = await ctx.db
          .query("userLocations")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        const locations = await Promise.all(
          assignments
            .filter((a) => a.tenantId === session.tenantId)
            .map(async (a) => {
              const loc = await ctx.db.get(a.locationId);
              return {
                locationId: a.locationId,
                locationName: loc?.name ?? "Unknown",
              };
            })
        );

        return {
          _id: user._id,
          name: user.name,
          email: user.email ?? null,
          role: user.role,
          status: user.status,
          hasPin: !!user.quickPinHash,
          locations,
          _creationTime: user._creationTime,
        };
      })
    );

    return enriched.filter(Boolean);
  },
});
