import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

// Generate upload URL for clock-in/out photos (no auth — used by PIN flow)
export const generatePhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Attach a photo + face match score to a timesheet
export const attachClockPhoto = mutation({
  args: {
    timesheetId: v.id("timesheets"),
    photoId: v.id("_storage"),
    type: v.union(v.literal("clock_in"), v.literal("clock_out")),
    faceMatch: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet) throw new Error("Timesheet not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.type === "clock_in") {
      updates.clockInPhotoId = args.photoId;
      if (args.faceMatch !== undefined) updates.clockInFaceMatch = args.faceMatch;
    } else {
      updates.clockOutPhotoId = args.photoId;
      if (args.faceMatch !== undefined) updates.clockOutFaceMatch = args.faceMatch;
    }
    if (args.faceMatch !== undefined && args.faceMatch < 0.5) {
      updates.photoFlagged = true;
    }
    await ctx.db.patch(args.timesheetId, updates);
  },
});

export const getPhotoUrl = query({
  args: { photoId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.photoId);
  },
});

export const togglePhotoFlag = mutation({
  args: {
    token: v.string(),
    timesheetId: v.id("timesheets"),
    flagged: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    const ts = await ctx.db.get(args.timesheetId);
    if (!ts || ts.tenantId !== session.tenantId) {
      throw new Error("Timesheet not found");
    }
    await ctx.db.patch(args.timesheetId, {
      photoFlagged: args.flagged,
      updatedAt: Date.now(),
    });
  },
});
