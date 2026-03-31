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
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const existing = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    const scheduleFields = {
      reportEmail: args.reportEmail,
      reportFrequency: args.reportFrequency,
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
