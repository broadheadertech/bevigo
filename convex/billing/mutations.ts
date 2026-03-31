import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const selectPlan = mutation({
  args: {
    token: v.string(),
    planSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner"]);

    // Find the plan
    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.planSlug))
      .unique();

    if (!plan || plan.status !== "active") {
      throw new Error("Plan not found or inactive");
    }

    const now = Date.now();
    // Period end: 30 days from now
    const periodEnd = now + 30 * 24 * 60 * 60 * 1000;

    // Check for existing subscription
    const existing = await ctx.db
      .query("tenantSubscriptions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", auth.tenantId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        planId: plan._id,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        monthlyOrderCount: existing.monthlyOrderCount,
        updatedAt: now,
      });
      return existing._id;
    }

    const subscriptionId = await ctx.db.insert("tenantSubscriptions", {
      tenantId: auth.tenantId,
      planId: plan._id,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      monthlyOrderCount: 0,
      updatedAt: now,
    });

    return subscriptionId;
  },
});

export const cancelSubscription = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner"]);

    const subscription = await ctx.db
      .query("tenantSubscriptions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", auth.tenantId))
      .unique();

    if (!subscription) {
      throw new Error("No active subscription found");
    }

    await ctx.db.patch(subscription._id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return subscription._id;
  },
});
