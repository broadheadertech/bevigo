import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const generateReferencePhotoUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setReferencePhoto = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    photoId: v.id("_storage"),
    faceDescriptor: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== session.tenantId) {
      throw new Error("User not found");
    }
    if (user.referencePhotoId) {
      try {
        await ctx.storage.delete(user.referencePhotoId);
      } catch {
        // ignore
      }
    }
    await ctx.db.patch(args.userId, {
      referencePhotoId: args.photoId,
      faceDescriptor: args.faceDescriptor,
      updatedAt: Date.now(),
    });
  },
});

export const removeReferencePhoto = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== session.tenantId) {
      throw new Error("User not found");
    }
    if (user.referencePhotoId) {
      try {
        await ctx.storage.delete(user.referencePhotoId);
      } catch {
        // ignore
      }
    }
    await ctx.db.patch(args.userId, {
      referencePhotoId: undefined,
      faceDescriptor: undefined,
      updatedAt: Date.now(),
    });
  },
});

// Get all face descriptors for staff at a location (used by clock-in for matching)
export const getLocationFaceDescriptors = query({
  args: { token: v.string(), locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const userLocs = await ctx.db
      .query("userLocations")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();
    const results: Array<{
      userId: typeof userLocs[number]["userId"];
      userName: string;
      faceDescriptor: number[];
    }> = [];
    for (const ul of userLocs) {
      if (ul.tenantId !== session.tenantId) continue;
      const user = await ctx.db.get(ul.userId);
      if (!user || !user.faceDescriptor) continue;
      results.push({
        userId: user._id,
        userName: user.name,
        faceDescriptor: user.faceDescriptor,
      });
    }
    return results;
  },
});

export const getUserReferencePhotoUrl = query({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== session.tenantId) return null;
    if (!user.referencePhotoId) return null;
    return await ctx.storage.getUrl(user.referencePhotoId);
  },
});
