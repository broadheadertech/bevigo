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
/**
 * Identify a staff member by PIN and return their current clock state.
 * Used by the staff clock kiosk to know which actions are available.
 */
export const pinIdentify = action({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.pin.length < 4 || args.pin.length > 6) {
      throw new Error("PIN must be 4-6 digits");
    }

    const staff = await ctx.runQuery(
      internal.timesheets.pinClockHelpers.listStaffWithPinAtLocation,
      { token: args.token, locationId: args.locationId }
    );

    let userId: Id<"users"> | null = null;
    let userName = "";
    for (const s of staff) {
      if (!s.quickPinHash) continue;
      const valid = await bcrypt.compare(args.pin, s.quickPinHash);
      if (valid) {
        userId = s._id;
        userName = s.name;
        break;
      }
    }

    if (!userId) throw new Error("Invalid PIN");

    const state = await ctx.runQuery(
      internal.timesheets.pinClockHelpers.getUserClockState,
      { userId, tenantToken: args.token }
    );

    return {
      userId,
      userName,
      ...state,
    };
  },
});

/**
 * Perform a clock action after PIN verification.
 * action: "clock_in" | "clock_out" | "start_break" | "end_break"
 */
export const pinAction = action({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    pin: v.string(),
    actionType: v.union(
      v.literal("clock_in"),
      v.literal("clock_out"),
      v.literal("start_break"),
      v.literal("end_break")
    ),
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

    let userId: Id<"users"> | null = null;
    let userName = "";
    for (const s of staff) {
      if (!s.quickPinHash) continue;
      const valid = await bcrypt.compare(args.pin, s.quickPinHash);
      if (valid) {
        userId = s._id;
        userName = s.name;
        break;
      }
    }

    if (!userId) throw new Error("Invalid PIN");

    const result = await ctx.runMutation(
      internal.timesheets.pinClockHelpers.performAction,
      {
        userId,
        locationId: args.locationId,
        tenantToken: args.token,
        actionType: args.actionType,
      }
    );

    // Attach photo on clock_in or clock_out
    if (args.photoId && result.timesheetId && (args.actionType === "clock_in" || args.actionType === "clock_out")) {
      await ctx.runMutation(api.timesheets.photoMutations.attachClockPhoto, {
        timesheetId: result.timesheetId,
        photoId: args.photoId,
        type: args.actionType === "clock_in" ? "clock_in" : "clock_out",
        faceMatch: args.faceMatch,
      });
    }

    return {
      ...result,
      userName,
    };
  },
});

// Legacy toggle action — kept for backward compat
export const pinClock = action({
  args: {
    token: v.string(),
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

    let userId: Id<"users"> | null = null;
    let userName = "";
    for (const s of staff) {
      if (!s.quickPinHash) continue;
      const valid = await bcrypt.compare(args.pin, s.quickPinHash);
      if (valid) {
        userId = s._id;
        userName = s.name;
        break;
      }
    }

    if (!userId) throw new Error("Invalid PIN");

    const result = await ctx.runMutation(
      internal.timesheets.pinClockHelpers.toggleClock,
      {
        userId,
        locationId: args.locationId,
        tenantToken: args.token,
      }
    );

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
      userName,
    };
  },
});
