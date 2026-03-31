import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Internal: find user by email across all tenants
export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .collect();

    if (users.length === 0) return null;
    return users[0];
  },
});

// Internal: create a new tenant + owner user
export const createOwnerWithTenant = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    shopName: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const tenantId = await ctx.db.insert("tenants", {
      name: args.shopName,
      slug: args.shopName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      currency: "PHP",
      timezone: "Asia/Manila",
      status: "active",
      updatedAt: now,
    });

    const userId = await ctx.db.insert("users", {
      tenantId,
      email: args.email,
      name: args.name,
      passwordHash: args.passwordHash,
      role: "owner",
      status: "active",
      updatedAt: now,
    });

    const locationId = await ctx.db.insert("locations", {
      tenantId,
      name: "Main Branch",
      slug: "main",
      timezone: "Asia/Manila",
      taxRate: 1200,
      taxLabel: "VAT",
      currency: "PHP",
      operatingHours: {
        monday: { open: "07:00", close: "21:00" },
        tuesday: { open: "07:00", close: "21:00" },
        wednesday: { open: "07:00", close: "21:00" },
        thursday: { open: "07:00", close: "21:00" },
        friday: { open: "07:00", close: "21:00" },
        saturday: { open: "08:00", close: "22:00" },
        sunday: { open: "08:00", close: "22:00" },
      },
      status: "active",
      updatedAt: now,
    });

    await ctx.db.insert("userLocations", {
      userId,
      locationId,
      tenantId,
    });

    return { userId, tenantId, locationId };
  },
});
