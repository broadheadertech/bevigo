import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireAuth, requireRole } from "../lib/auth";

/**
 * Internal helper — earn points for a customer after order completion.
 * Called directly from completeOrder (not a registered Convex function).
 */
export async function earnPointsInternal(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  customerId: Id<"customers">,
  orderId: Id<"orders">,
  orderTotal: number,
  orderNumber: string,
) {
  const settings = await ctx.db
    .query("tenantSettings")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .unique();

  const earnRate = settings?.pointsEarnRate ?? 1000; // default: 1 point per ₱10 (1000 centavos)
  const pointsEarned = Math.floor(orderTotal / earnRate);

  if (pointsEarned <= 0) return 0;

  const customer = await ctx.db.get(customerId);
  if (!customer) return 0;

  await ctx.db.patch(customerId, {
    pointsBalance: (customer.pointsBalance ?? 0) + pointsEarned,
  });

  await ctx.db.insert("pointsLedger", {
    customerId,
    tenantId,
    type: "earned",
    points: pointsEarned,
    description: `Order #${orderNumber} (${orderTotal} total)`,
    orderId,
    createdAt: Date.now(),
  });

  return pointsEarned;
}

export const redeemReward = mutation({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
    rewardId: v.id("rewards"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    const reward = await ctx.db.get(args.rewardId);
    if (!reward || reward.tenantId !== session.tenantId) {
      throw new Error("Reward not found");
    }
    if (reward.status !== "active") {
      throw new Error("This reward is no longer available");
    }

    const balance = customer.pointsBalance ?? 0;
    if (balance < reward.pointsCost) {
      throw new Error(
        `Not enough points. Need ${reward.pointsCost}, have ${balance}.`
      );
    }

    // Deduct points
    await ctx.db.patch(args.customerId, {
      pointsBalance: balance - reward.pointsCost,
    });

    // Create ledger entry
    await ctx.db.insert("pointsLedger", {
      customerId: args.customerId,
      tenantId: session.tenantId,
      type: "redeemed",
      points: -reward.pointsCost,
      description: `Redeemed: ${reward.name}`,
      rewardId: args.rewardId,
      createdAt: Date.now(),
    });

    return {
      rewardName: reward.name,
      pointsDeducted: reward.pointsCost,
      category: reward.category,
      discountAmount: reward.discountAmount,
      maxValue: reward.maxValue,
    };
  },
});

export const adjustPoints = mutation({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
    points: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    const currentBalance = customer.pointsBalance ?? 0;
    const newBalance = currentBalance + args.points;

    if (newBalance < 0) {
      throw new Error("Cannot adjust below zero. Current balance: " + currentBalance);
    }

    await ctx.db.patch(args.customerId, {
      pointsBalance: newBalance,
    });

    await ctx.db.insert("pointsLedger", {
      customerId: args.customerId,
      tenantId: session.tenantId,
      type: "adjusted",
      points: args.points,
      description: args.description,
      createdAt: Date.now(),
    });

    return { newBalance };
  },
});
