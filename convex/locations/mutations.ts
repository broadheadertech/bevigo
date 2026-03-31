import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

const operatingHoursValidator = v.object({
  monday: v.optional(v.object({ open: v.string(), close: v.string() })),
  tuesday: v.optional(v.object({ open: v.string(), close: v.string() })),
  wednesday: v.optional(v.object({ open: v.string(), close: v.string() })),
  thursday: v.optional(v.object({ open: v.string(), close: v.string() })),
  friday: v.optional(v.object({ open: v.string(), close: v.string() })),
  saturday: v.optional(v.object({ open: v.string(), close: v.string() })),
  sunday: v.optional(v.object({ open: v.string(), close: v.string() })),
});

export const createLocation = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    slug: v.string(),
    address: v.optional(v.string()),
    timezone: v.string(),
    taxRate: v.number(),
    taxLabel: v.string(),
    currency: v.string(),
    operatingHours: operatingHoursValidator,
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Validate slug uniqueness within tenant
    const existingBySlug = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const slugTaken = existingBySlug.some((loc) => loc.slug === args.slug);
    if (slugTaken) {
      throw new Error("A location with this slug already exists");
    }

    const now = Date.now();
    const locationId = await ctx.db.insert("locations", {
      tenantId: session.tenantId,
      name: args.name,
      slug: args.slug,
      address: args.address,
      timezone: args.timezone,
      taxRate: args.taxRate,
      taxLabel: args.taxLabel,
      currency: args.currency,
      operatingHours: args.operatingHours,
      status: args.status ?? "active",
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "location_created",
      "locations",
      locationId,
      {
        name: args.name,
        slug: args.slug,
        timezone: args.timezone,
        taxRate: args.taxRate,
        taxLabel: args.taxLabel,
        currency: args.currency,
      }
    );

    return locationId;
  },
});

export const updateLocation = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    address: v.optional(v.string()),
    timezone: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    taxLabel: v.optional(v.string()),
    currency: v.optional(v.string()),
    operatingHours: v.optional(operatingHoursValidator),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    // If slug is changing, validate uniqueness
    if (args.slug !== undefined && args.slug !== location.slug) {
      const tenantLocations = await ctx.db
        .query("locations")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .collect();

      const slugTaken = tenantLocations.some(
        (loc) => loc.slug === args.slug && loc._id !== args.locationId
      );
      if (slugTaken) {
        throw new Error("A location with this slug already exists");
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.address !== undefined) updates.address = args.address;
    if (args.timezone !== undefined) updates.timezone = args.timezone;
    if (args.taxRate !== undefined) updates.taxRate = args.taxRate;
    if (args.taxLabel !== undefined) updates.taxLabel = args.taxLabel;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.operatingHours !== undefined) updates.operatingHours = args.operatingHours;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.locationId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "location_updated",
      "locations",
      args.locationId,
      updates
    );

    return args.locationId;
  },
});
