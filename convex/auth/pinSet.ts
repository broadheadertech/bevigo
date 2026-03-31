"use node";

import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import bcrypt from "bcryptjs";
import { internal } from "../_generated/api";

export const setQuickPin = action({
  args: {
    token: v.string(),
    targetUserId: v.id("users"),
    locationId: v.id("locations"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validate caller has permission
    const auth = await ctx.runQuery(internal.auth.helpers.validateSession, {
      token: args.token,
    });
    if (!auth || (auth.role !== "owner" && auth.role !== "manager")) {
      throw new ConvexError("Only owners and managers can set PINs");
    }

    // 2. Validate PIN format
    if (!/^\d{4,6}$/.test(args.pin)) {
      throw new ConvexError("PIN must be 4-6 digits");
    }

    // 3. Check uniqueness at this location
    const locationUsers = await ctx.runQuery(
      internal.auth.helpers.getActiveUsersAtLocation,
      { locationId: args.locationId }
    );

    for (const user of locationUsers) {
      if (user._id === args.targetUserId) continue;
      if (!user.quickPinHash) continue;
      const isDuplicate = await bcrypt.compare(args.pin, user.quickPinHash);
      if (isDuplicate) {
        throw new ConvexError(
          "This PIN is already in use by another staff member at this location"
        );
      }
    }

    // 4. Hash and store
    const hash = await bcrypt.hash(args.pin, 12);
    await ctx.runMutation(internal.auth.helpers.setUserPinHash, {
      userId: args.targetUserId,
      quickPinHash: hash,
    });

    // 5. Audit log
    await ctx.runMutation(internal.audit.helpers.write, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: "pin_set",
      entityType: "users",
      entityId: args.targetUserId,
      changes: {},
    });

    return { success: true };
  },
});
