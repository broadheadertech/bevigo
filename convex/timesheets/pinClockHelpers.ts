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
