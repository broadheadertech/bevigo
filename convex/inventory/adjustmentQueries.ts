import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { Doc } from "../_generated/dataModel";

export const listAdjustments = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
    type: v.optional(
      v.union(
        v.literal("wastage"),
        v.literal("correction"),
        v.literal("stocktake"),
        v.literal("transfer")
      )
    ),
    ingredientId: v.optional(v.id("ingredients")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    let adjustments: Doc<"stockAdjustments">[];

    if (args.type) {
      adjustments = await ctx.db
        .query("stockAdjustments")
        .withIndex("by_tenant_type", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("type", args.type!)
        )
        .collect();
    } else {
      adjustments = await ctx.db
        .query("stockAdjustments")
        .withIndex("by_tenant", (q: any) =>
          q.eq("tenantId", session.tenantId)
        )
        .collect();
    }

    if (args.locationId) {
      adjustments = adjustments.filter(
        (a: Doc<"stockAdjustments">) => a.locationId === args.locationId
      );
    }

    if (args.ingredientId) {
      adjustments = adjustments.filter(
        (a: Doc<"stockAdjustments">) => a.ingredientId === args.ingredientId
      );
    }

    // Sort newest first
    adjustments.sort(
      (a: Doc<"stockAdjustments">, b: Doc<"stockAdjustments">) =>
        b.createdAt - a.createdAt
    );

    if (args.limit) {
      adjustments = adjustments.slice(0, args.limit);
    }

    const results = await Promise.all(
      adjustments.map(async (adj: Doc<"stockAdjustments">) => {
        const ingredient = await ctx.db.get(adj.ingredientId);
        const location = await ctx.db.get(adj.locationId);
        const user = await ctx.db.get(adj.userId);

        return {
          ...adj,
          ingredientName: ingredient?.name ?? "Unknown",
          ingredientUnit: ingredient?.unit ?? "",
          locationName: location?.name ?? "Unknown",
          userName: user?.name ?? "Unknown",
        };
      })
    );

    return results;
  },
});
