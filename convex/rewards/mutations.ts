import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const createReward = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    pointsCost: v.number(),
    category: v.union(
      v.literal("drink"),
      v.literal("food"),
      v.literal("merch"),
      v.literal("discount")
    ),
    discountAmount: v.optional(v.number()),
    maxValue: v.optional(v.number()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const rewardId = await ctx.db.insert("rewards", {
      tenantId: session.tenantId,
      name: args.name,
      description: args.description,
      pointsCost: args.pointsCost,
      category: args.category,
      discountAmount: args.discountAmount,
      maxValue: args.maxValue,
      status: "active",
      sortOrder: args.sortOrder,
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "reward.created",
      "rewards",
      rewardId,
      { name: args.name, pointsCost: args.pointsCost, category: args.category }
    );

    return rewardId;
  },
});

export const updateReward = mutation({
  args: {
    token: v.string(),
    rewardId: v.id("rewards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    pointsCost: v.optional(v.number()),
    category: v.optional(
      v.union(
        v.literal("drink"),
        v.literal("food"),
        v.literal("merch"),
        v.literal("discount")
      )
    ),
    discountAmount: v.optional(v.number()),
    maxValue: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("inactive"))
    ),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const reward = await ctx.db.get(args.rewardId);
    if (!reward || reward.tenantId !== session.tenantId) {
      throw new Error("Reward not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.pointsCost !== undefined) updates.pointsCost = args.pointsCost;
    if (args.category !== undefined) updates.category = args.category;
    if (args.discountAmount !== undefined) updates.discountAmount = args.discountAmount;
    if (args.maxValue !== undefined) updates.maxValue = args.maxValue;
    if (args.status !== undefined) updates.status = args.status;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;

    await ctx.db.patch(args.rewardId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "reward.updated",
      "rewards",
      args.rewardId,
      updates
    );

    return args.rewardId;
  },
});
