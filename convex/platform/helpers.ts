import { mutation, query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Look up a platform-admin session by its token. Returns null when the
 * session is missing, expired, or the underlying admin is inactive. Used
 * by both the platform UI and the cross-tenant requireAuth fallback.
 */
export async function findPlatformSession(
  ctx: QueryCtx,
  token: string
): Promise<{
  session: Doc<"platformSessions">;
  admin: Doc<"platformAdmins">;
} | null> {
  const session = await ctx.db
    .query("platformSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) return null;

  const admin = await ctx.db.get(session.platformAdminId);
  if (!admin || admin.status !== "active") return null;

  return { session, admin };
}

/**
 * Internal-style mutation invoked by the login action (which lives in a
 * Node action because bcrypt). Splits the DB write off from the bcrypt CPU
 * work so the action stays fast.
 */
export const insertPlatformSession = mutation({
  args: {
    platformAdminId: v.id("platformAdmins"),
    token: v.string(),
    expiresAt: v.number(),
    deviceInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("platformSessions", {
      platformAdminId: args.platformAdminId,
      token: args.token,
      expiresAt: args.expiresAt,
      deviceInfo: args.deviceInfo,
    });
  },
});

export const findPlatformAdminByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    return await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const insertPlatformAdmin = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) throw new ConvexError("Platform admin already exists");

    const now = Date.now();
    return await ctx.db.insert("platformAdmins", {
      email,
      name: args.name,
      passwordHash: args.passwordHash,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Re-export Id helper so action files don't need to pull from _generated
 * just to type their helper invocations.
 */
export type PlatformAdminId = Id<"platformAdmins">;
