"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const seedDefaultRewards = action({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rewards = [
      {
        name: "Free Extra Shot",
        description: "Add an extra espresso shot to any drink",
        pointsCost: 20,
        category: "drink" as const,
        sortOrder: 1,
      },
      {
        name: "Free Size Upgrade",
        description: "Upgrade any drink to the next size",
        pointsCost: 30,
        category: "drink" as const,
        sortOrder: 2,
      },
      {
        name: "Free Pastry",
        description: "Any pastry from the display case",
        pointsCost: 80,
        category: "food" as const,
        sortOrder: 3,
      },
      {
        name: "Free Any Drink (up to P200)",
        description: "Any drink from the menu up to P200 value",
        pointsCost: 150,
        category: "drink" as const,
        maxValue: 20000, // ₱200 in centavos
        sortOrder: 4,
      },
      {
        name: "bevi&co Mug",
        description: "Exclusive branded ceramic mug",
        pointsCost: 300,
        category: "merch" as const,
        sortOrder: 5,
      },
      {
        name: "Free Bag of Beans",
        description: "250g bag of our house blend",
        pointsCost: 500,
        category: "merch" as const,
        sortOrder: 6,
      },
    ];

    for (const reward of rewards) {
      await ctx.runMutation(api.seedHelpers.insertReward, {
        tenantId: args.tenantId,
        name: reward.name,
        description: reward.description,
        pointsCost: reward.pointsCost,
        category: reward.category,
        maxValue: reward.maxValue,
        status: "active",
        sortOrder: reward.sortOrder,
        updatedAt: now,
      });
    }

    return { seeded: rewards.length };
  },
});
