import { mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

const DEFAULT_OT_DAILY_HOURS = 8;
const DEFAULT_OT_MULTIPLIER = 12500; // 1.25x in basis points
const BASIS = 10000;

async function getOvertimeSettings(
  ctx: MutationCtx,
  tenantId: Id<"tenants">
): Promise<{ overtimeDailyHours: number; overtimeMultiplier: number; autoClockOutHours: number }> {
  const settings = await ctx.db
    .query("tenantSettings")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .unique();
  return {
    overtimeDailyHours: settings?.overtimeDailyHours ?? DEFAULT_OT_DAILY_HOURS,
    overtimeMultiplier: settings?.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER,
    autoClockOutHours: settings?.autoClockOutHours ?? 12,
  };
}

export async function computeTimesheetTotals(
  ctx: MutationCtx,
  timesheet: Doc<"timesheets">,
  clockOutAt: number
): Promise<{
  workMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  regularMinutes: number;
  hourlyRate: number;
  earnedAmount: number;
  overtimeAmount: number;
}> {
  const breaks = await ctx.db
    .query("timesheetBreaks")
    .withIndex("by_timesheet", (q) => q.eq("timesheetId", timesheet._id))
    .collect();

  let totalBreakMinutes = 0;
  let unpaidBreakMinutes = 0;
  for (const b of breaks) {
    const end = b.endedAt ?? clockOutAt;
    const dur = Math.max(0, Math.round((end - b.startedAt) / 60000));
    totalBreakMinutes += dur;
    if (b.type === "unpaid") unpaidBreakMinutes += dur;
  }

  const elapsedMinutes = Math.max(
    0,
    Math.round((clockOutAt - timesheet.clockInAt) / 60000)
  );
  const workMinutes = Math.max(0, elapsedMinutes - unpaidBreakMinutes);

  const { overtimeDailyHours, overtimeMultiplier } = await getOvertimeSettings(
    ctx,
    timesheet.tenantId
  );
  const otThresholdMinutes = overtimeDailyHours * 60;
  const overtimeMinutes = Math.max(0, workMinutes - otThresholdMinutes);
  const regularMinutes = workMinutes - overtimeMinutes;

  const user = await ctx.db.get(timesheet.userId);
  const hourlyRate = timesheet.hourlyRate ?? user?.hourlyRate ?? 0;

  const regularPay = Math.round((regularMinutes / 60) * hourlyRate);
  const overtimeAmount = Math.round(
    (overtimeMinutes / 60) * hourlyRate * (overtimeMultiplier / BASIS)
  );
  const earnedAmount = regularPay + overtimeAmount;

  return {
    workMinutes,
    breakMinutes: totalBreakMinutes,
    overtimeMinutes,
    regularMinutes,
    hourlyRate,
    earnedAmount,
    overtimeAmount,
  };
}

export const clockIn = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireLocationAccess(session, args.locationId);

    const existingActive = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", session.userId).eq("status", "active")
      )
      .first();

    if (existingActive) {
      throw new ConvexError("You already have an active timesheet. Clock out first.");
    }
    const existingOnBreak = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", session.userId).eq("status", "on_break")
      )
      .first();
    if (existingOnBreak) {
      throw new ConvexError("You already have an active timesheet (on break). Clock out first.");
    }

    const now = Date.now();
    const timesheetId = await ctx.db.insert("timesheets", {
      tenantId: session.tenantId,
      userId: session.userId,
      locationId: args.locationId,
      clockInAt: now,
      status: "active",
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "timesheet_clock_in",
      "timesheets",
      timesheetId,
      { clockInAt: now, locationId: args.locationId }
    );

    return timesheetId;
  },
});

export const clockOut = mutation({
  args: {
    token: v.string(),
    timesheetId: v.id("timesheets"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet || timesheet.tenantId !== session.tenantId) {
      throw new ConvexError("Timesheet not found");
    }

    const isOwnerOrManager =
      session.role === "owner" || session.role === "manager";
    if (timesheet.userId !== session.userId && !isOwnerOrManager) {
      throw new ConvexError("Not authorized to clock out this timesheet");
    }

    if (timesheet.status !== "active" && timesheet.status !== "on_break") {
      throw new ConvexError("Timesheet is not active");
    }

    const now = Date.now();

    // End any active break
    if (timesheet.status === "on_break") {
      const activeBreak = await ctx.db
        .query("timesheetBreaks")
        .withIndex("by_timesheet", (q) => q.eq("timesheetId", timesheet._id))
        .collect();
      for (const b of activeBreak) {
        if (!b.endedAt) {
          const dur = Math.max(0, Math.round((now - b.startedAt) / 60000));
          await ctx.db.patch(b._id, { endedAt: now, durationMinutes: dur });
        }
      }
    }

    const totals = await computeTimesheetTotals(ctx, timesheet, now);

    await ctx.db.patch(args.timesheetId, {
      clockOutAt: now,
      workMinutes: totals.workMinutes,
      breakMinutes: totals.breakMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      overtimeAmount: totals.overtimeAmount,
      hourlyRate: totals.hourlyRate,
      earnedAmount: totals.earnedAmount,
      status: "completed",
      notes: args.notes,
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "timesheet_clock_out",
      "timesheets",
      args.timesheetId,
      {
        clockOutAt: now,
        workMinutes: totals.workMinutes,
        breakMinutes: totals.breakMinutes,
        overtimeMinutes: totals.overtimeMinutes,
        hourlyRate: totals.hourlyRate,
        earnedAmount: totals.earnedAmount,
      }
    );

    return {
      workMinutes: totals.workMinutes,
      earnedAmount: totals.earnedAmount,
      overtimeMinutes: totals.overtimeMinutes,
      breakMinutes: totals.breakMinutes,
    };
  },
});

export const startBreak = mutation({
  args: {
    token: v.string(),
    timesheetId: v.id("timesheets"),
    type: v.optional(v.union(v.literal("paid"), v.literal("unpaid"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet || timesheet.tenantId !== session.tenantId) {
      throw new ConvexError("Timesheet not found");
    }

    const isOwnerOrManager =
      session.role === "owner" || session.role === "manager";
    if (timesheet.userId !== session.userId && !isOwnerOrManager) {
      throw new ConvexError("Not authorized");
    }
    if (timesheet.status !== "active") {
      throw new ConvexError("Timesheet is not active");
    }

    const now = Date.now();
    const breakId = await ctx.db.insert("timesheetBreaks", {
      timesheetId: timesheet._id,
      tenantId: session.tenantId,
      startedAt: now,
      type: args.type ?? "unpaid",
    });

    await ctx.db.patch(timesheet._id, {
      status: "on_break",
      updatedAt: now,
    });

    return breakId;
  },
});

export const endBreak = mutation({
  args: {
    token: v.string(),
    timesheetId: v.id("timesheets"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet || timesheet.tenantId !== session.tenantId) {
      throw new ConvexError("Timesheet not found");
    }
    const isOwnerOrManager =
      session.role === "owner" || session.role === "manager";
    if (timesheet.userId !== session.userId && !isOwnerOrManager) {
      throw new ConvexError("Not authorized");
    }

    const breaks = await ctx.db
      .query("timesheetBreaks")
      .withIndex("by_timesheet", (q) => q.eq("timesheetId", timesheet._id))
      .collect();
    const activeBreak = breaks.find((b) => !b.endedAt);
    if (!activeBreak) {
      throw new ConvexError("No active break found");
    }

    const now = Date.now();
    const dur = Math.max(0, Math.round((now - activeBreak.startedAt) / 60000));
    await ctx.db.patch(activeBreak._id, {
      endedAt: now,
      durationMinutes: dur,
    });
    await ctx.db.patch(timesheet._id, {
      status: "active",
      updatedAt: now,
    });

    return { durationMinutes: dur };
  },
});

export const approveTimesheet = mutation({
  args: {
    token: v.string(),
    timesheetId: v.id("timesheets"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet || timesheet.tenantId !== session.tenantId) {
      throw new ConvexError("Timesheet not found");
    }
    if (timesheet.status !== "completed" && timesheet.status !== "auto_closed") {
      throw new ConvexError("Only completed timesheets can be approved");
    }

    const now = Date.now();
    await ctx.db.patch(args.timesheetId, {
      approvedBy: session.userId,
      approvedAt: now,
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "timesheet_approved",
      "timesheets",
      args.timesheetId,
      { approvedBy: session.userId, approvedAt: now }
    );
  },
});

export const updateTimesheet = mutation({
  args: {
    token: v.string(),
    timesheetId: v.id("timesheets"),
    clockInAt: v.optional(v.number()),
    clockOutAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet || timesheet.tenantId !== session.tenantId) {
      throw new ConvexError("Timesheet not found");
    }

    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    const changedFields: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    if (args.clockInAt !== undefined && args.clockInAt !== timesheet.clockInAt) {
      patch.clockInAt = args.clockInAt;
      changedFields.push({
        field: "clockInAt",
        oldValue: timesheet.clockInAt,
        newValue: args.clockInAt,
      });
    }
    if (
      args.clockOutAt !== undefined &&
      args.clockOutAt !== timesheet.clockOutAt
    ) {
      patch.clockOutAt = args.clockOutAt;
      changedFields.push({
        field: "clockOutAt",
        oldValue: timesheet.clockOutAt,
        newValue: args.clockOutAt,
      });
    }
    if (args.notes !== undefined && args.notes !== timesheet.notes) {
      patch.notes = args.notes;
      changedFields.push({
        field: "notes",
        oldValue: timesheet.notes,
        newValue: args.notes,
      });
    }

    if (changedFields.length === 0) {
      return;
    }

    // Recalculate totals if times changed
    const newClockIn = args.clockInAt ?? timesheet.clockInAt;
    const newClockOut = args.clockOutAt ?? timesheet.clockOutAt;
    if (
      (args.clockInAt !== undefined || args.clockOutAt !== undefined) &&
      newClockOut !== undefined
    ) {
      const tempTimesheet: Doc<"timesheets"> = {
        ...timesheet,
        clockInAt: newClockIn,
      };
      const totals = await computeTimesheetTotals(ctx, tempTimesheet, newClockOut);
      patch.workMinutes = totals.workMinutes;
      patch.breakMinutes = totals.breakMinutes;
      patch.overtimeMinutes = totals.overtimeMinutes;
      patch.overtimeAmount = totals.overtimeAmount;
      patch.earnedAmount = totals.earnedAmount;
      patch.hourlyRate = totals.hourlyRate;
    }

    patch.editedBy = session.userId;
    patch.editedAt = now;
    if (args.reason !== undefined) patch.editReason = args.reason;

    // Insert edit history records
    for (const change of changedFields) {
      await ctx.db.insert("timesheetEdits", {
        timesheetId: timesheet._id,
        tenantId: session.tenantId,
        editedBy: session.userId,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        reason: args.reason,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.timesheetId, patch);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "timesheet_updated",
      "timesheets",
      args.timesheetId,
      { changes: changedFields, reason: args.reason }
    );
  },
});

export const setHourlyRate = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    hourlyRate: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== session.tenantId) {
      throw new ConvexError("User not found");
    }

    if (args.hourlyRate < 0) {
      throw new ConvexError("Hourly rate must be non-negative");
    }

    const previous = user.hourlyRate;
    await ctx.db.patch(args.userId, {
      hourlyRate: args.hourlyRate,
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "user_hourly_rate_set",
      "users",
      args.userId,
      { from: previous, to: args.hourlyRate }
    );
  },
});
