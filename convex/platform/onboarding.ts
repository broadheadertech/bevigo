"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import bcrypt from "bcryptjs";

/**
 * Onboard a fresh tenant. Wraps the bcrypt hash + bundled insert into one
 * call so the wizard can spin a workspace in a single round-trip and
 * optionally jump into impersonation.
 */
export const createTenant = action({
  args: {
    token: v.string(),

    name: v.string(),
    slug: v.string(),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),

    businessName: v.optional(v.string()),
    tradeName: v.optional(v.string()),
    businessAddress: v.optional(v.string()),
    tin: v.optional(v.string()),
    vatStatus: v.optional(
      v.union(v.literal("vat"), v.literal("non_vat"), v.literal("vat_exempt"))
    ),

    locationName: v.string(),
    locationAddress: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    taxLabel: v.optional(v.string()),

    ownerEmail: v.string(),
    ownerName: v.string(),
    ownerPassword: v.string(),

    seedSampleData: v.optional(v.boolean()),
    impersonateAfter: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.ownerPassword.length < 8) {
      throw new Error("Owner password must be at least 8 characters");
    }
    if (!args.name.trim()) throw new Error("Workspace name is required");
    if (!args.locationName.trim()) throw new Error("Location name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.ownerEmail.trim())) {
      throw new Error("Owner email is invalid");
    }

    // Confirm the caller is a real platform admin before doing any work.
    const me = await ctx.runQuery(api.platform.session.me, { token: args.token });
    if (!me) throw new Error("Unauthorized");

    const passwordHash = await bcrypt.hash(args.ownerPassword, 12);

    const result = await ctx.runMutation(
      internal.platform.onboardingHelpers.insertTenantBundle,
      {
        name: args.name.trim(),
        slug: args.slug.trim().toLowerCase(),
        currency: args.currency ?? "PHP",
        timezone: args.timezone ?? "Asia/Manila",
        businessName: args.businessName,
        tradeName: args.tradeName,
        businessAddress: args.businessAddress,
        tin: args.tin,
        vatStatus: args.vatStatus,
        locationName: args.locationName.trim(),
        locationAddress: args.locationAddress,
        taxRate: args.taxRate ?? 1200,
        taxLabel: args.taxLabel ?? "VAT",
        ownerEmail: args.ownerEmail.trim().toLowerCase(),
        ownerName: args.ownerName.trim(),
        ownerPasswordHash: passwordHash,
        seedSampleData: args.seedSampleData ?? true,
      }
    );

    if (args.impersonateAfter) {
      await ctx.runMutation(api.platform.session.switchTenant, {
        token: args.token,
        tenantId: result.tenantId,
      });
    }

    return result;
  },
});
