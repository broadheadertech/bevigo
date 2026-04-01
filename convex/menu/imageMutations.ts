import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

// Generate a short-lived upload URL for the client
export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.storage.generateUploadUrl();
  },
});

// Set the image on a menu item after upload
export const setItemImage = mutation({
  args: {
    token: v.string(),
    itemId: v.id("menuItems"),
    imageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Delete old image if exists
    if (item.imageId) {
      await ctx.storage.delete(item.imageId);
    }

    await ctx.db.patch(args.itemId, {
      imageId: args.imageId,
      updatedAt: Date.now(),
    });

    return args.itemId;
  },
});

// Remove image from a menu item
export const removeItemImage = mutation({
  args: {
    token: v.string(),
    itemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    if (item.imageId) {
      await ctx.storage.delete(item.imageId);
    }

    await ctx.db.patch(args.itemId, {
      imageId: undefined,
      updatedAt: Date.now(),
    });
  },
});

// Get image URL for a menu item
export const getImageUrl = query({
  args: { imageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.imageId);
  },
});
