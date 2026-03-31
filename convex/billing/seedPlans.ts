import { mutation } from "../_generated/server";

type PlanSeed = {
  name: string;
  slug: string;
  maxLocations: number;
  maxOrdersPerMonth: number;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  status: "active" | "inactive";
};

const DEFAULT_PLANS: PlanSeed[] = [
  {
    name: "Free",
    slug: "free",
    maxLocations: 1,
    maxOrdersPerMonth: 100,
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "1 location",
      "100 orders/month",
      "Basic POS",
      "Menu management",
    ],
    status: "active",
  },
  {
    name: "Starter",
    slug: "starter",
    maxLocations: 3,
    maxOrdersPerMonth: 1000,
    priceMonthly: 999,
    priceYearly: 9990,
    features: [
      "3 locations",
      "1,000 orders/month",
      "Inventory tracking",
      "Staff management",
      "Basic reports",
    ],
    status: "active",
  },
  {
    name: "Pro",
    slug: "pro",
    maxLocations: 10,
    maxOrdersPerMonth: 10000,
    priceMonthly: 2499,
    priceYearly: 24990,
    features: [
      "10 locations",
      "10,000 orders/month",
      "Advanced reports",
      "Customer loyalty",
      "Modifier groups",
      "Priority support",
    ],
    status: "active",
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    maxLocations: 999,
    maxOrdersPerMonth: 999999,
    priceMonthly: 4999,
    priceYearly: 49990,
    features: [
      "Unlimited locations",
      "Unlimited orders",
      "All Pro features",
      "API access",
      "Dedicated support",
      "Custom integrations",
    ],
    status: "active",
  },
];

export const seedDefaultPlans = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if plans already exist
    const existing = await ctx.db
      .query("subscriptionPlans")
      .take(1);

    if (existing.length > 0) {
      return { message: "Plans already seeded", count: 0 };
    }

    for (const plan of DEFAULT_PLANS) {
      await ctx.db.insert("subscriptionPlans", plan);
    }

    return { message: "Default plans seeded", count: DEFAULT_PLANS.length };
  },
});
