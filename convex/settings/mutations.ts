import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

const MIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const updateIdleLockTimeout = mutation({
  args: {
    token: v.string(),
    idleLockTimeoutMs: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    if (args.idleLockTimeoutMs < MIN_IDLE_TIMEOUT_MS) {
      throw new ConvexError(
        `Idle timeout must be at least ${MIN_IDLE_TIMEOUT_MS / 60000} minutes`
      );
    }

    const existing = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        idleLockTimeoutMs: args.idleLockTimeoutMs,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("tenantSettings", {
        tenantId: session.tenantId,
        idleLockTimeoutMs: args.idleLockTimeoutMs,
        updatedAt: Date.now(),
      });
    }

    // Audit log
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "settings_updated",
      "tenantSettings",
      session.tenantId,
      { idleLockTimeoutMs: args.idleLockTimeoutMs }
    );

    return { success: true };
  },
});

export const updateBranding = mutation({
  args: {
    token: v.string(),
    brandName: v.optional(v.string()),
    brandLogoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const existing = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    const brandingFields = {
      brandName: args.brandName,
      brandLogoUrl: args.brandLogoUrl,
      primaryColor: args.primaryColor,
      accentColor: args.accentColor,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...brandingFields,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("tenantSettings", {
        tenantId: session.tenantId,
        idleLockTimeoutMs: 5 * 60 * 1000,
        ...brandingFields,
        updatedAt: Date.now(),
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "branding_updated",
      "tenantSettings",
      session.tenantId,
      brandingFields
    );

    return { success: true };
  },
});

export const updateCustomDomain = mutation({
  args: {
    token: v.string(),
    customDomain: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const existing = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customDomain: args.customDomain,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("tenantSettings", {
        tenantId: session.tenantId,
        idleLockTimeoutMs: 5 * 60 * 1000,
        customDomain: args.customDomain,
        updatedAt: Date.now(),
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "custom_domain_updated",
      "tenantSettings",
      session.tenantId,
      { customDomain: args.customDomain }
    );

    return { success: true };
  },
});

export const updatePointsEarnRate = mutation({
  args: {
    token: v.string(),
    pointsEarnRate: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    if (args.pointsEarnRate < 100) {
      throw new ConvexError("Earn rate must be at least 100 (₱1)");
    }

    const existing = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pointsEarnRate: args.pointsEarnRate,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("tenantSettings", {
        tenantId: session.tenantId,
        idleLockTimeoutMs: 5 * 60 * 1000,
        pointsEarnRate: args.pointsEarnRate,
        updatedAt: Date.now(),
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "points_earn_rate_updated",
      "tenantSettings",
      session.tenantId,
      { pointsEarnRate: args.pointsEarnRate }
    );

    return { success: true };
  },
});

export const updatePayrollSettings = mutation({
  args: {
    token: v.string(),
    overtimeDailyHours: v.number(),
    overtimeMultiplier: v.number(), // basis points
    autoClockOutHours: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    if (args.overtimeDailyHours < 0 || args.overtimeDailyHours > 24) {
      throw new ConvexError("Daily OT hours must be between 0 and 24");
    }
    if (args.overtimeMultiplier < 10000) {
      throw new ConvexError("OT multiplier must be at least 1.0x (10000)");
    }
    if (args.autoClockOutHours < 1 || args.autoClockOutHours > 48) {
      throw new ConvexError("Auto clock-out hours must be between 1 and 48");
    }

    const existing = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    const fields = {
      overtimeDailyHours: args.overtimeDailyHours,
      overtimeMultiplier: args.overtimeMultiplier,
      autoClockOutHours: args.autoClockOutHours,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...fields,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("tenantSettings", {
        tenantId: session.tenantId,
        idleLockTimeoutMs: 5 * 60 * 1000,
        ...fields,
        updatedAt: Date.now(),
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "payroll_settings_updated",
      "tenantSettings",
      session.tenantId,
      fields
    );

    return { success: true };
  },
});

function isValidHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export const updateReportSchedule = mutation({
  args: {
    token: v.string(),
    reportEmail: v.string(),
    reportFrequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("none")
    ),
    sendPartialReport: v.optional(v.boolean()),
    partialReportTime: v.optional(v.string()),
    dailyReportTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    if (args.partialReportTime && !isValidHHMM(args.partialReportTime)) {
      throw new ConvexError("Partial report time must be HH:MM (24-hour)");
    }
    if (args.dailyReportTime && !isValidHHMM(args.dailyReportTime)) {
      throw new ConvexError("Daily report time must be HH:MM (24-hour)");
    }

    const existing = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    const scheduleFields = {
      reportEmail: args.reportEmail,
      reportFrequency: args.reportFrequency,
      sendPartialReport: args.sendPartialReport ?? false,
      partialReportTime: args.partialReportTime ?? "14:00",
      dailyReportTime: args.dailyReportTime ?? "22:00",
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...scheduleFields,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("tenantSettings", {
        tenantId: session.tenantId,
        idleLockTimeoutMs: 5 * 60 * 1000,
        ...scheduleFields,
        updatedAt: Date.now(),
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "report_schedule_updated",
      "tenantSettings",
      session.tenantId,
      scheduleFields
    );

    return { success: true };
  },
});
