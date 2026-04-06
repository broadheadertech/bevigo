"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const seedDefaultPresets = action({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const presets = [
      {
        name: "Senior/PWD",
        type: "percentage" as const,
        value: 20,
        reason: "Senior/PWD",
        requiresAuth: false,
        sortOrder: 1,
      },
      {
        name: "Employee Discount",
        type: "percentage" as const,
        value: 30,
        reason: "Employee",
        requiresAuth: true,
        sortOrder: 2,
      },
      {
        name: "Manager Override",
        type: "fixed" as const,
        value: 0,
        reason: "Manager Override",
        requiresAuth: true,
        sortOrder: 3,
      },
      {
        name: "Happy Hour",
        type: "percentage" as const,
        value: 15,
        reason: "Promo - Happy Hour",
        requiresAuth: false,
        sortOrder: 4,
      },
      {
        name: "First-Time Customer",
        type: "percentage" as const,
        value: 10,
        reason: "Promo - New Customer",
        requiresAuth: false,
        sortOrder: 5,
      },
      {
        name: "Friends & Family",
        type: "percentage" as const,
        value: 25,
        reason: "Friends & Family",
        requiresAuth: true,
        sortOrder: 6,
      },
    ];

    for (const preset of presets) {
      await ctx.runMutation(api.seedHelpers.insertDiscountPreset, {
        tenantId: args.tenantId,
        name: preset.name,
        type: preset.type,
        value: preset.value,
        reason: preset.reason,
        requiresAuth: preset.requiresAuth,
        status: "active",
        sortOrder: preset.sortOrder,
        updatedAt: now,
      });
    }

    return { seeded: presets.length };
  },
});
