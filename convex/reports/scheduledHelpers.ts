import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { Id } from "../_generated/dataModel";

/**
 * Used from "use node" actions where requireAuth (which needs db access)
 * can't run directly. Returns just the bits the action needs.
 */
export const authenticateOwner = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ tenantId: Id<"tenants">; userId: Id<"users"> }> => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);
    return { tenantId: session.tenantId, userId: session.userId };
  },
});

export const getTenantReportConfig = internalQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;
    const settings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();
    return {
      tenantName: tenant.name,
      timezone: tenant.timezone,
      reportEmail: settings?.reportEmail,
      reportFrequency: settings?.reportFrequency,
      sendPartialReport: settings?.sendPartialReport ?? false,
      partialReportTime: settings?.partialReportTime ?? "14:00",
      dailyReportTime: settings?.dailyReportTime ?? "22:00",
    };
  },
});
