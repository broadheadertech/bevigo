import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const getSessionByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
  },
});

export const validateSession = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;

    const user = await ctx.db.get(session.userId);
    if (!user || user.status !== "active") return null;

    const userLocs = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", session.userId))
      .collect();

    return {
      userId: session.userId,
      tenantId: session.tenantId,
      role: user.role as "owner" | "manager" | "barista",
      locationIds: userLocs.map((ul) => ul.locationId),
    };
  },
});

export const getActiveUsersAtLocation = internalQuery({
  args: { locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const userLocs = await ctx.db
      .query("userLocations")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    const users = [];
    for (const ul of userLocs) {
      const user = await ctx.db.get(ul.userId);
      if (user && user.status === "active") {
        users.push(user);
      }
    }
    return users;
  },
});

export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    tenantId: v.id("tenants"),
    token: v.string(),
    expiresAt: v.number(),
    deviceInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      userId: args.userId,
      tenantId: args.tenantId,
      token: args.token,
      expiresAt: args.expiresAt,
      deviceInfo: args.deviceInfo,
    });
  },
});

export const setUserPinHash = internalMutation({
  args: {
    userId: v.id("users"),
    quickPinHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      quickPinHash: args.quickPinHash,
      updatedAt: Date.now(),
    });
  },
});
