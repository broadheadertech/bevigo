"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import bcrypt from "bcryptjs";
import { Id } from "../_generated/dataModel";

/**
 * PIN-based clock in/out for staff. No session token required —
 * staff identifies themselves by PIN at the staff clock-in screen.
 *
 * The owner's session token is used to scope the lookup to the tenant
 * and location, but the actual clock action is keyed to the staff member
 * matching the PIN.
 */
export const pinClock = action({
  args: {
    token: v.string(), // owner/manager session token (for tenant scope)
    locationId: v.id("locations"),
    pin: v.string(),
    photoId: v.optional(v.id("_storage")),
    faceMatch: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.pin.length < 4 || args.pin.length > 6) {
      throw new Error("PIN must be 4-6 digits");
    }

    const staff = await ctx.runQuery(
      internal.timesheets.pinClockHelpers.listStaffWithPinAtLocation,
      { token: args.token, locationId: args.locationId }
    );

    let matchedUserId: Id<"users"> | null = null;
    let matchedUserName = "";
    for (const s of staff) {
      if (!s.quickPinHash) continue;
      const valid = await bcrypt.compare(args.pin, s.quickPinHash);
      if (valid) {
        matchedUserId = s._id;
        matchedUserName = s.name;
        break;
      }
    }

    if (!matchedUserId) {
      throw new Error("Invalid PIN");
    }

    const result = await ctx.runMutation(
      internal.timesheets.pinClockHelpers.toggleClock,
      {
        userId: matchedUserId,
        locationId: args.locationId,
        tenantToken: args.token,
      }
    );

    // Attach photo if provided
    if (args.photoId && result.timesheetId) {
      await ctx.runMutation(api.timesheets.photoMutations.attachClockPhoto, {
        timesheetId: result.timesheetId,
        photoId: args.photoId,
        type: result.action === "clocked_in" ? "clock_in" : "clock_out",
        faceMatch: args.faceMatch,
      });
    }

    return {
      ...result,
      userName: matchedUserName,
    };
  },
});
