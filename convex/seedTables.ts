"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const run = action({
  args: {},
  handler: async (ctx) => {
    const { token } = await ctx.runAction(api.auth.login.login, {
      email: "owner@democoffee.ph",
      password: "brewcast123",
    });

    const locations = await ctx.runQuery(api.settings.queries.listLocations, { token });
    const mainBranch = locations.find((l: any) => l.slug === "main-branch");
    if (!mainBranch) return { error: "No main branch found" };

    const result = await ctx.runMutation(api.tables.seed.seedTables, {
      token,
      locationId: mainBranch._id,
    });

    return result;
  },
});
