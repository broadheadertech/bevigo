import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const getFailures = internalQuery({
  args: {
    deviceToken: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pinFailures")
      .withIndex("by_device_location", (q) =>
        q.eq("deviceToken", args.deviceToken).eq("locationId", args.locationId)
      )
      .unique();
  },
});

export const recordFailure = internalMutation({
  args: {
    deviceToken: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pinFailures")
      .withIndex("by_device_location", (q) =>
        q.eq("deviceToken", args.deviceToken).eq("locationId", args.locationId)
      )
      .unique();

    if (existing) {
      const newCount = existing.failureCount + 1;
      await ctx.db.patch(existing._id, {
        failureCount: newCount,
        lastFailureAt: Date.now(),
      });
      return { failureCount: newCount };
    } else {
      await ctx.db.insert("pinFailures", {
        deviceToken: args.deviceToken,
        locationId: args.locationId,
        failureCount: 1,
        lastFailureAt: Date.now(),
      });
      return { failureCount: 1 };
    }
  },
});

export const resetFailures = internalMutation({
  args: {
    deviceToken: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pinFailures")
      .withIndex("by_device_location", (q) =>
        q.eq("deviceToken", args.deviceToken).eq("locationId", args.locationId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        failureCount: 0,
        lastFailureAt: Date.now(),
      });
    }
  },
});
