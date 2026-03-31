"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import bcrypt from "bcryptjs";

// Public action: email/password login
export const login = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(
      internal.auth.loginHelpers.findUserByEmail,
      { email: args.email }
    );

    if (!user || !user.passwordHash) {
      throw new Error("Invalid email or password");
    }

    const valid = await bcrypt.compare(args.password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    if (user.status !== "active") {
      throw new Error("Account is inactive");
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.runMutation(internal.auth.helpers.createSession, {
      userId: user._id,
      tenantId: user.tenantId,
      token,
      expiresAt,
      deviceInfo: "web-browser",
    });

    return { token, role: user.role };
  },
});

// Public action: register new owner + tenant
export const register = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    shopName: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const existing = await ctx.runQuery(
      internal.auth.loginHelpers.findUserByEmail,
      { email: args.email }
    );
    if (existing) {
      throw new Error("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(args.password, 12);

    const result = await ctx.runMutation(
      internal.auth.loginHelpers.createOwnerWithTenant,
      {
        email: args.email,
        name: args.name,
        shopName: args.shopName,
        passwordHash,
      }
    );

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.runMutation(internal.auth.helpers.createSession, {
      userId: result.userId,
      tenantId: result.tenantId,
      token,
      expiresAt,
      deviceInfo: "web-browser",
    });

    return { token, role: "owner" };
  },
});
