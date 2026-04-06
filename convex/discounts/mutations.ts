import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const createPreset = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    type: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
    reason: v.string(),
    requiresAuth: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const presetId = await ctx.db.insert("discountPresets", {
      tenantId: session.tenantId,
      name: args.name,
      type: args.type,
      value: args.value,
      reason: args.reason,
      requiresAuth: args.requiresAuth,
      status: "active",
      sortOrder: args.sortOrder,
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "discountPreset.created",
      "discountPresets",
      presetId,
      { name: args.name, type: args.type, value: args.value }
    );

    return presetId;
  },
});

export const updatePreset = mutation({
  args: {
    token: v.string(),
    presetId: v.id("discountPresets"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("percentage"), v.literal("fixed"))),
    value: v.optional(v.number()),
    reason: v.optional(v.string()),
    requiresAuth: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const preset = await ctx.db.get(args.presetId);
    if (!preset || preset.tenantId !== session.tenantId) {
      throw new Error("Discount preset not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.type !== undefined) updates.type = args.type;
    if (args.value !== undefined) updates.value = args.value;
    if (args.reason !== undefined) updates.reason = args.reason;
    if (args.requiresAuth !== undefined) updates.requiresAuth = args.requiresAuth;
    if (args.status !== undefined) updates.status = args.status;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;

    await ctx.db.patch(args.presetId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "discountPreset.updated",
      "discountPresets",
      args.presetId,
      updates
    );

    return args.presetId;
  },
});
