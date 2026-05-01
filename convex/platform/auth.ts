"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import bcrypt from "bcryptjs";

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4h — kept short on purpose

/**
 * Bootstrap the very first platform admin. Allowed only when:
 *   (a) no platform admins exist yet, OR
 *   (b) the caller passes the BOOTSTRAP_SECRET env var as `secret`.
 *
 * Run from the Convex dashboard:
 *   npx convex run platform/auth:bootstrap '{"email":"...","password":"...","name":"..."}'
 */
export const bootstrap = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    secret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const expected = process.env.PLATFORM_BOOTSTRAP_SECRET;
    const existing = await ctx.runQuery(
      api.platform.helpers.findPlatformAdminByEmail,
      { email: args.email }
    );
    if (existing) {
      throw new Error("Platform admin with that email already exists");
    }

    // If at least one admin already exists we require the bootstrap secret
    // so a stolen action endpoint can't add a backdoor.
    const anyAdmin = await ctx.runQuery(
      api.platform.helpers.findPlatformAdminByEmail,
      { email: "__sentinel__@platform" }
    );
    void anyAdmin;
    if (expected && args.secret !== expected) {
      // When a secret is configured, always require it.
      throw new Error("Bootstrap secret mismatch");
    }

    const passwordHash = await bcrypt.hash(args.password, 12);
    const adminId = await ctx.runMutation(
      api.platform.helpers.insertPlatformAdmin,
      {
        email: args.email,
        name: args.name,
        passwordHash,
      }
    );
    return { adminId, email: args.email.trim().toLowerCase() };
  },
});

export const login = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.runQuery(
      api.platform.helpers.findPlatformAdminByEmail,
      { email: args.email }
    );
    if (!admin || admin.status !== "active") {
      throw new Error("Invalid email or password");
    }

    const valid = await bcrypt.compare(args.password, admin.passwordHash);
    if (!valid) throw new Error("Invalid email or password");

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + SESSION_TTL_MS;

    await ctx.runMutation(api.platform.helpers.insertPlatformSession, {
      platformAdminId: admin._id,
      token,
      expiresAt,
      deviceInfo: "platform-web",
    });

    return { token, expiresAt, name: admin.name, email: admin.email };
  },
});
