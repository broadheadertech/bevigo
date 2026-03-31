import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const listLocations = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    // Count staff per location
    const allUserLocations = await ctx.db
      .query("userLocations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    return locations.map((loc) => {
      const staffCount = allUserLocations.filter(
        (ul) => ul.locationId === loc._id
      ).length;

      return {
        _id: loc._id,
        name: loc.name,
        slug: loc.slug,
        address: loc.address,
        timezone: loc.timezone,
        taxRate: loc.taxRate,
        taxLabel: loc.taxLabel,
        currency: loc.currency,
        operatingHours: loc.operatingHours,
        status: loc.status,
        updatedAt: loc.updatedAt,
        staffCount,
      };
    });
  },
});

export const getLocation = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    return {
      _id: location._id,
      name: location.name,
      slug: location.slug,
      address: location.address,
      timezone: location.timezone,
      taxRate: location.taxRate,
      taxLabel: location.taxLabel,
      currency: location.currency,
      operatingHours: location.operatingHours,
      status: location.status,
      updatedAt: location.updatedAt,
    };
  },
});
