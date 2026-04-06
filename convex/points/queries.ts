import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const getCustomerPoints = query({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    const recentHistory = await ctx.db
      .query("pointsLedger")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(20);

    return {
      balance: customer.pointsBalance ?? 0,
      recentHistory,
    };
  },
});

export const getPointsHistory = query({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    const limit = args.limit ?? 50;
    const history = await ctx.db
      .query("pointsLedger")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(limit);

    return history;
  },
});
