import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const listPresets = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const presets = await ctx.db
      .query("discountPresets")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    // Sort by sortOrder ascending
    presets.sort((a, b) => a.sortOrder - b.sortOrder);

    return presets;
  },
});

export const listAllPresets = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const presets = await ctx.db
      .query("discountPresets")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    // Sort by sortOrder ascending
    presets.sort((a, b) => a.sortOrder - b.sortOrder);

    return presets;
  },
});
