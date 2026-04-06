import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const listRewards = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    // Sort by pointsCost ascending
    rewards.sort((a, b) => a.pointsCost - b.pointsCost);

    return rewards;
  },
});

export const listAllRewards = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    // Sort by sortOrder
    rewards.sort((a, b) => a.sortOrder - b.sortOrder);

    return rewards;
  },
});
