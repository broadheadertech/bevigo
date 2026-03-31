import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db
      .query("subscriptionPlans")
      .collect();

    return plans.filter(
      (plan: { status: string }) => plan.status === "active"
    );
  },
});

export const getCurrentSubscription = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);

    const subscription = await ctx.db
      .query("tenantSubscriptions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", auth.tenantId))
      .unique();

    if (!subscription) {
      return null;
    }

    const plan = await ctx.db.get(subscription.planId);

    return {
      ...subscription,
      plan: plan ?? null,
    };
  },
});

export const getUsageStats = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);
    requireRole(auth, ["owner"]);

    // Get subscription
    const subscription = await ctx.db
      .query("tenantSubscriptions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", auth.tenantId))
      .unique();

    // Get plan details
    const plan = subscription
      ? await ctx.db.get(subscription.planId)
      : null;

    // Count active locations
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant_status", (q: any) =>
        q.eq("tenantId", auth.tenantId).eq("status", "active")
      )
      .collect();

    const locationCount = locations.length;
    const monthlyOrderCount = subscription?.monthlyOrderCount ?? 0;
    const maxLocations = plan?.maxLocations ?? 1;
    const maxOrdersPerMonth = plan?.maxOrdersPerMonth ?? 100;

    // Overage checks
    const orderUsagePercent =
      maxOrdersPerMonth > 0
        ? Math.round((monthlyOrderCount / maxOrdersPerMonth) * 100)
        : 0;
    const locationUsagePercent =
      maxLocations > 0
        ? Math.round((locationCount / maxLocations) * 100)
        : 0;

    return {
      monthlyOrderCount,
      maxOrdersPerMonth,
      orderUsagePercent,
      locationCount,
      maxLocations,
      locationUsagePercent,
      isOverOrderLimit: monthlyOrderCount >= maxOrdersPerMonth,
      isOverLocationLimit: locationCount >= maxLocations,
      planName: plan?.name ?? "No Plan",
      planSlug: plan?.slug ?? null,
    };
  },
});
