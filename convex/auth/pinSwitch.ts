"use node";

import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import bcrypt from "bcryptjs";
import { internal } from "../_generated/api";
import crypto from "crypto";

export const pinSwitch = action({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validate PIN format
    if (!/^\d{4,6}$/.test(args.pin)) {
      throw new ConvexError("PIN must be 4-6 digits");
    }

    // 2. Validate current session exists (even if switching user)
    const session = await ctx.runQuery(internal.auth.helpers.getSessionByToken, {
      token: args.token,
    });
    if (!session) {
      throw new ConvexError("Invalid session");
    }

    // 3. Check if device is locked out (5 consecutive failures)
    const failures = await ctx.runQuery(internal.auth.pinFailures.getFailures, {
      deviceToken: args.token,
      locationId: args.locationId,
    });
    if (failures && failures.failureCount >= 5) {
      return { success: false as const, locked: true, requireFullLogin: true };
    }

    // 4. Get all active users at this location
    const locationUsers = await ctx.runQuery(
      internal.auth.helpers.getActiveUsersAtLocation,
      { locationId: args.locationId }
    );

    // 5. Compare PIN against each user's hash
    for (const user of locationUsers) {
      if (!user.quickPinHash) continue;

      const match = await bcrypt.compare(args.pin, user.quickPinHash);
      if (match) {
        // 6. Generate new session token
        const newToken = crypto.randomBytes(32).toString("hex");
        const expiresAt =
          user.role === "barista"
            ? Date.now() + 8 * 60 * 60 * 1000 // 8 hours
            : Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        // 7. Create new session via internal mutation
        await ctx.runMutation(internal.auth.helpers.createSession, {
          userId: user._id,
          tenantId: user.tenantId,
          token: newToken,
          expiresAt,
          deviceInfo: session.deviceInfo,
        });

        // 8. Reset failure counter
        await ctx.runMutation(internal.auth.pinFailures.resetFailures, {
          deviceToken: args.token,
          locationId: args.locationId,
        });

        return {
          success: true as const,
          token: newToken,
          userName: user.name,
          role: user.role,
        };
      }
    }

    // 9. No match — record failure
    const updatedFailures = await ctx.runMutation(
      internal.auth.pinFailures.recordFailure,
      {
        deviceToken: args.token,
        locationId: args.locationId,
      }
    );

    const attemptsRemaining = 5 - updatedFailures.failureCount;
    if (attemptsRemaining <= 0) {
      return { success: false as const, locked: true, requireFullLogin: true };
    }

    return {
      success: false as const,
      locked: false,
      attemptsRemaining,
    };
  },
});
