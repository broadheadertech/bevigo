"use node";

import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import bcrypt from "bcryptjs";

export const voidOrder = action({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    authorizerPin: v.string(),
    voidReason: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validate PIN format
    if (!/^\d{4,6}$/.test(args.authorizerPin)) {
      throw new ConvexError("PIN must be 4-6 digits");
    }

    if (!args.voidReason.trim()) {
      throw new ConvexError("Void reason is required");
    }

    // 2. Validate order and get eligible authorizers
    const result = await ctx.runQuery(
      internal.orders.internals.validateOrderForVoid,
      {
        orderId: args.orderId,
        token: args.token,
      }
    );

    if ("error" in result) {
      throw new ConvexError(result.error as string);
    }

    const { order, authorizers, sessionUserId } = result;

    // 3. Compare PIN against each eligible authorizer's hash
    for (const authorizer of authorizers) {
      const match = await bcrypt.compare(
        args.authorizerPin,
        authorizer.quickPinHash
      );
      if (match) {
        // 4. Execute the void
        await ctx.runMutation(internal.orders.internals.executeVoid, {
          orderId: args.orderId,
          voidedBy: authorizer._id,
          voidReason: args.voidReason.trim(),
          tenantId: order.tenantId,
          authorizerName: authorizer.name,
        });

        return {
          success: true as const,
          authorizerName: authorizer.name,
        };
      }
    }

    // 5. No match — log failed attempt
    await ctx.runMutation(internal.orders.internals.logVoidFailure, {
      orderId: args.orderId,
      tenantId: order.tenantId,
      userId: sessionUserId,
    });

    throw new ConvexError("Invalid authorization PIN");
  },
});
