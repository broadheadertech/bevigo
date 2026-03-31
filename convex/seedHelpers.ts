import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const insertTenant = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    currency: v.string(),
    timezone: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended")),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tenants", args);
  },
});

export const insertLocation = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    slug: v.string(),
    address: v.optional(v.string()),
    timezone: v.string(),
    taxRate: v.number(),
    taxLabel: v.string(),
    currency: v.string(),
    operatingHours: v.object({
      monday: v.optional(v.object({ open: v.string(), close: v.string() })),
      tuesday: v.optional(v.object({ open: v.string(), close: v.string() })),
      wednesday: v.optional(v.object({ open: v.string(), close: v.string() })),
      thursday: v.optional(v.object({ open: v.string(), close: v.string() })),
      friday: v.optional(v.object({ open: v.string(), close: v.string() })),
      saturday: v.optional(v.object({ open: v.string(), close: v.string() })),
      sunday: v.optional(v.object({ open: v.string(), close: v.string() })),
    }),
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("locations", args);
  },
});

export const insertUser = mutation({
  args: {
    tenantId: v.id("tenants"),
    email: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    name: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("manager"),
      v.literal("barista")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", args);
  },
});

export const insertUserLocation = mutation({
  args: {
    userId: v.id("users"),
    locationId: v.id("locations"),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("userLocations", args);
  },
});

export const insertCategory = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    sortOrder: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("categories", args);
  },
});
