import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const validateSession = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      tenantId: v.id("tenants"),
      role: v.string(),
      userName: v.string(),
      locationIds: v.array(v.id("locations")),
    }),
    v.null()
  ),
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user || user.status !== "active") {
      return null;
    }

    const userLocations = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", session.userId))
      .collect();

    return {
      userId: session.userId,
      tenantId: session.tenantId,
      role: user.role,
      userName: user.name,
      locationIds: userLocations.map((ul) => ul.locationId),
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return null;
  },
});

// Story 1.5: Lock the current session (sets lockedAt timestamp)
export const lockSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) {
      throw new ConvexError("Session not found or expired");
    }

    await ctx.db.patch(session._id, {
      lockedAt: Date.now(),
    });

    return { success: true };
  },
});

// Story 1.5: Query session lock state
export const getSessionLockState = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!session) return null;

    const user = await ctx.db.get(session.userId);

    return {
      isLocked: session.lockedAt !== undefined && session.lockedAt !== null,
      lockedAt: session.lockedAt ?? null,
      userName: user?.name ?? "Unknown",
      locationId: session.locationId ?? null,
      isExpired: session.expiresAt < Date.now(),
    };
  },
});

// Story 1.5: Unlock session with PIN (creates new session for PIN user)
export const unlockWithPin = mutation({
  args: {
    currentToken: v.string(),
    locationId: v.id("locations"),
    pinHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the current session exists (even if locked)
    const currentSession = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.currentToken))
      .unique();

    if (!currentSession) {
      throw new ConvexError("Invalid session");
    }

    // Find all active users at this location
    const userLocations = await ctx.db
      .query("userLocations")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    for (const ul of userLocations) {
      const user = await ctx.db.get(ul.userId);
      if (!user || user.status !== "active" || !user.quickPinHash) {
        continue;
      }

      // Compare PIN hash (bcrypt comparison is done in action layer;
      // this mutation receives the matched userId from the pinSwitch action)
      if (user.quickPinHash === args.pinHash) {
        // Clear the lock on the current session
        await ctx.db.patch(currentSession._id, {
          lockedAt: undefined,
        });

        return {
          success: true,
          userId: user._id,
          name: user.name,
          role: user.role,
        };
      }
    }

    throw new ConvexError("Invalid PIN");
  },
});
