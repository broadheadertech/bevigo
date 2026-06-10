import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

/**
 * Feature entitlements derived from the tenant's current plan. Kept as a
 * pure function of the plan slug so we don't need to schema-migrate
 * existing plan rows when adding a new entitlement — adjust the table
 * below and every tenant on that slug gets the new flag at next render.
 *
 * Order of escalation: free → starter → pro → enterprise.
 */
type Entitlements = {
  planSlug: string | null;
  planName: string;
  hidePoweredBy: boolean;
  customDomain: boolean;
  brandedEmails: boolean;
};

function entitlementsForPlan(
  slug: string | null,
  name: string
): Entitlements {
  const base: Entitlements = {
    planSlug: slug,
    planName: name,
    hidePoweredBy: false,
    customDomain: false,
    brandedEmails: false,
  };
  switch (slug) {
    case "pro":
      return { ...base, hidePoweredBy: true, brandedEmails: true };
    case "enterprise":
      return {
        ...base,
        hidePoweredBy: true,
        customDomain: true,
        brandedEmails: true,
      };
    default:
      return base;
  }
}

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

/**
 * Public surface for entitlements. Available to any authenticated user
 * (not owner-only) because the dashboard chrome needs it on every
 * render — gating it behind role checks would force every staff session
 * to render "Powered by" momentarily before suppressing it.
 */
export const getEntitlements = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx, args.token);

    const subscription = await ctx.db
      .query("tenantSubscriptions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", auth.tenantId))
      .unique();
    if (!subscription) return entitlementsForPlan(null, "No Plan");

    const plan = await ctx.db.get(subscription.planId);
    // A cancelled / past-due tenant drops back to free entitlements until
    // they reactivate. Trial counts as the assigned plan so trialists
    // get the full white-label experience while evaluating.
    if (subscription.status === "cancelled" || subscription.status === "past_due") {
      return entitlementsForPlan(null, plan?.name ?? "Cancelled");
    }

    return entitlementsForPlan(plan?.slug ?? null, plan?.name ?? "No Plan");
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
