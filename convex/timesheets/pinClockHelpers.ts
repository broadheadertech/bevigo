import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { Id } from "../_generated/dataModel";

/**
 * Internal query to list staff at a location with PIN set.
 * Uses owner/manager session token for tenant isolation.
 */
export const listStaffWithPinAtLocation = internalQuery({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Get all userLocations at this location
    const userLocs = await ctx.db
      .query("userLocations")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    const results = [];
    for (const ul of userLocs) {
      if (ul.tenantId !== session.tenantId) continue;
      const user = await ctx.db.get(ul.userId);
      if (!user || user.status !== "active" || !user.quickPinHash) continue;
      results.push({
        _id: user._id,
        name: user.name,
        quickPinHash: user.quickPinHash,
      });
    }
    return results;
  },
});

/**
 * Internal mutation to toggle clock in / clock out for a specific user.
 * Called from the pinClock action after PIN verification.
 */
export const toggleClock = internalMutation({
  args: {
    userId: v.id("users"),
    locationId: v.id("locations"),
    tenantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.tenantToken);
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== session.tenantId) {
      throw new Error("User not found");
    }

    // Find active timesheet for this user
    const active = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    const onBreak = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "on_break")
      )
      .first();

    const existing = active || onBreak;

    if (existing) {
      // Clock out
      const now = Date.now();
      const totalElapsed = Math.floor((now - existing.clockInAt) / 60000);

      // Get unpaid breaks
      const breaks = await ctx.db
        .query("timesheetBreaks")
        .withIndex("by_timesheet", (q) => q.eq("timesheetId", existing._id))
        .collect();

      let totalBreakMinutes = 0;
      let unpaidBreakMinutes = 0;
      for (const br of breaks) {
        const end = br.endedAt ?? now;
        const dur = Math.floor((end - br.startedAt) / 60000);
        totalBreakMinutes += dur;
        if (br.type === "unpaid") unpaidBreakMinutes += dur;

        // Auto-end any active break
        if (!br.endedAt) {
          await ctx.db.patch(br._id, {
            endedAt: now,
            durationMinutes: dur,
          });
        }
      }

      const workMinutes = Math.max(0, totalElapsed - unpaidBreakMinutes);

      // Read tenant settings for OT
      const settings = await ctx.db
        .query("tenantSettings")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .unique();
      const otThresholdHours = settings?.overtimeDailyHours ?? 8;
      const otMultiplierBp = settings?.overtimeMultiplier ?? 12500;
      const hourlyRate = user.hourlyRate ?? 0;

      const otThresholdMinutes = otThresholdHours * 60;
      const overtimeMinutes = Math.max(0, workMinutes - otThresholdMinutes);
      const regularMinutes = workMinutes - overtimeMinutes;

      const regularPay = (regularMinutes / 60) * hourlyRate;
      const otPay = (overtimeMinutes / 60) * hourlyRate * (otMultiplierBp / 10000);
      const earnedAmount = Math.round(regularPay + otPay);
      const overtimeAmount = Math.round(otPay);

      await ctx.db.patch(existing._id, {
        clockOutAt: now,
        workMinutes,
        breakMinutes: totalBreakMinutes,
        overtimeMinutes,
        overtimeAmount,
        hourlyRate,
        earnedAmount,
        status: "completed",
        updatedAt: now,
      });

      return {
        action: "clocked_out" as const,
        workMinutes,
        earnedAmount,
        timesheetId: existing._id,
      };
    } else {
      // Clock in
      const now = Date.now();
      const timesheetId = await ctx.db.insert("timesheets", {
        tenantId: session.tenantId,
        userId: args.userId,
        locationId: args.locationId,
        clockInAt: now,
        status: "active",
        updatedAt: now,
      });

      return {
        action: "clocked_in" as const,
        timesheetId: timesheetId as Id<"timesheets">,
        clockInAt: now,
      };
    }
  },
});

/**
 * Get the current clock state for a user.
 */
export const getUserClockState = internalQuery({
  args: {
    userId: v.id("users"),
    tenantToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.tenantToken);

    const active = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    if (active) {
      return {
        status: "active" as const,
        timesheetId: active._id,
        clockInAt: active.clockInAt,
      };
    }

    const onBreak = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "on_break")
      )
      .first();

    if (onBreak) {
      // Find the active break
      const breaks = await ctx.db
        .query("timesheetBreaks")
        .withIndex("by_timesheet", (q) => q.eq("timesheetId", onBreak._id))
        .collect();
      const activeBreak = breaks.find((b) => !b.endedAt);

      return {
        status: "on_break" as const,
        timesheetId: onBreak._id,
        clockInAt: onBreak.clockInAt,
        breakStartedAt: activeBreak?.startedAt,
      };
    }

    return { status: "none" as const };
  },
});

/**
 * Perform a specific clock action.
 */
export const performAction = internalMutation({
  args: {
    userId: v.id("users"),
    locationId: v.id("locations"),
    tenantToken: v.string(),
    actionType: v.union(
      v.literal("clock_in"),
      v.literal("clock_out"),
      v.literal("start_break"),
      v.literal("end_break")
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.tenantToken);
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== session.tenantId) {
      throw new Error("User not found");
    }

    const active = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    const onBreak = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "on_break")
      )
      .first();

    const now = Date.now();

    if (args.actionType === "clock_in") {
      if (active || onBreak) {
        throw new Error("Already clocked in");
      }
      const timesheetId = await ctx.db.insert("timesheets", {
        tenantId: session.tenantId,
        userId: args.userId,
        locationId: args.locationId,
        clockInAt: now,
        status: "active",
        updatedAt: now,
      });
      return {
        action: "clocked_in" as const,
        timesheetId,
        clockInAt: now,
      };
    }

    if (args.actionType === "start_break") {
      if (!active) {
        throw new Error(onBreak ? "Already on break" : "Not clocked in");
      }
      await ctx.db.insert("timesheetBreaks", {
        timesheetId: active._id,
        tenantId: session.tenantId,
        startedAt: now,
        type: "unpaid",
      });
      await ctx.db.patch(active._id, {
        status: "on_break",
        updatedAt: now,
      });
      return {
        action: "break_started" as const,
        timesheetId: active._id,
        breakStartedAt: now,
      };
    }

    if (args.actionType === "end_break") {
      if (!onBreak) {
        throw new Error("Not on break");
      }
      const breaks = await ctx.db
        .query("timesheetBreaks")
        .withIndex("by_timesheet", (q) => q.eq("timesheetId", onBreak._id))
        .collect();
      const activeBreak = breaks.find((b) => !b.endedAt);
      if (activeBreak) {
        const dur = Math.floor((now - activeBreak.startedAt) / 60000);
        await ctx.db.patch(activeBreak._id, {
          endedAt: now,
          durationMinutes: dur,
        });
      }
      await ctx.db.patch(onBreak._id, {
        status: "active",
        updatedAt: now,
      });
      return {
        action: "break_ended" as const,
        timesheetId: onBreak._id,
      };
    }

    if (args.actionType === "clock_out") {
      const existing = active || onBreak;
      if (!existing) {
        throw new Error("Not clocked in");
      }
      const totalElapsed = Math.floor((now - existing.clockInAt) / 60000);

      const breaks = await ctx.db
        .query("timesheetBreaks")
        .withIndex("by_timesheet", (q) => q.eq("timesheetId", existing._id))
        .collect();

      let totalBreakMinutes = 0;
      let unpaidBreakMinutes = 0;
      for (const br of breaks) {
        const end = br.endedAt ?? now;
        const dur = Math.floor((end - br.startedAt) / 60000);
        totalBreakMinutes += dur;
        if (br.type === "unpaid") unpaidBreakMinutes += dur;
        if (!br.endedAt) {
          await ctx.db.patch(br._id, {
            endedAt: now,
            durationMinutes: dur,
          });
        }
      }

      const workMinutes = Math.max(0, totalElapsed - unpaidBreakMinutes);

      const settings = await ctx.db
        .query("tenantSettings")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .unique();
      const otThresholdHours = settings?.overtimeDailyHours ?? 8;
      const otMultiplierBp = settings?.overtimeMultiplier ?? 12500;
      const hourlyRate = user.hourlyRate ?? 0;

      const otThresholdMinutes = otThresholdHours * 60;
      const overtimeMinutes = Math.max(0, workMinutes - otThresholdMinutes);
      const regularMinutes = workMinutes - overtimeMinutes;

      const regularPay = (regularMinutes / 60) * hourlyRate;
      const otPay = (overtimeMinutes / 60) * hourlyRate * (otMultiplierBp / 10000);
      const earnedAmount = Math.round(regularPay + otPay);
      const overtimeAmount = Math.round(otPay);

      await ctx.db.patch(existing._id, {
        clockOutAt: now,
        workMinutes,
        breakMinutes: totalBreakMinutes,
        overtimeMinutes,
        overtimeAmount,
        hourlyRate,
        earnedAmount,
        status: "completed",
        updatedAt: now,
      });

      return {
        action: "clocked_out" as const,
        workMinutes,
        earnedAmount,
        timesheetId: existing._id,
      };
    }

    throw new Error("Invalid action");
  },
});
