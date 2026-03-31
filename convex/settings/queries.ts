import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const getSettings = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const settings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    if (!settings) {
      return {
        idleLockTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
      };
    }

    return {
      idleLockTimeoutMs: settings.idleLockTimeoutMs,
      reportEmail: settings.reportEmail,
      reportFrequency: settings.reportFrequency,
    };
  },
});

export const getBranding = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const settings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .unique();

    return {
      brandName: settings?.brandName ?? "",
      brandLogoUrl: settings?.brandLogoUrl ?? "",
      primaryColor: settings?.primaryColor ?? "#7C3A12",
      accentColor: settings?.accentColor ?? "#D97706",
      customDomain: settings?.customDomain ?? "",
    };
  },
});

export const listLocations = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    return locations.map((loc) => ({
      _id: loc._id,
      name: loc.name,
      slug: loc.slug,
      status: loc.status,
    }));
  },
});
