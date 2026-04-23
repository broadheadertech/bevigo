"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import bcrypt from "bcryptjs";

/**
 * One-shot production bootstrap.
 *
 * Creates the bare minimum needed to log in for the first time:
 *   - one tenant ("Bevigo")
 *   - one location ("Main Branch") so the owner has somewhere to work
 *   - one owner user (admin@bevigo.ph) linked to that location
 *
 * Idempotent: re-running after the tenant exists is a no-op (returns the
 * existing IDs). It will never overwrite the password of an existing admin.
 *
 * Defaults can be overridden via args, but the password defaults to the
 * agreed bootstrap value. CHANGE IT FROM THE DASHBOARD AFTER FIRST LOGIN.
 */
export const seedProduction = action({
  args: {
    tenantName: v.optional(v.string()),
    tenantSlug: v.optional(v.string()),
    locationName: v.optional(v.string()),
    locationSlug: v.optional(v.string()),
    adminEmail: v.optional(v.string()),
    adminPassword: v.optional(v.string()),
    adminName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const tenantName = args.tenantName ?? "Bevigo";
    const tenantSlug = args.tenantSlug ?? "bevigo";
    const locationName = args.locationName ?? "Main Branch";
    const locationSlug = args.locationSlug ?? "main-branch";
    const adminEmail = args.adminEmail ?? "admin@bevigo.ph";
    const adminPassword = args.adminPassword ?? "@Bevigo1234";
    const adminName = args.adminName ?? "Admin";

    // Idempotency guard: if the tenant slug is already taken, bail out
    // cleanly instead of creating a duplicate. Production must never have
    // two "bevigo" tenants.
    const existing = await ctx.runQuery(api.seedHelpers.findTenantBySlug, {
      slug: tenantSlug,
    });
    if (existing) {
      return {
        alreadySeeded: true as const,
        tenantId: existing._id,
        message:
          "Tenant already exists — production seed skipped. Manage users from the dashboard.",
      };
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const tenantId = await ctx.runMutation(api.seedHelpers.insertTenant, {
      name: tenantName,
      slug: tenantSlug,
      currency: "PHP",
      timezone: "Asia/Manila",
      status: "active",
      updatedAt: now,
    });

    const locationId = await ctx.runMutation(api.seedHelpers.insertLocation, {
      tenantId,
      name: locationName,
      slug: locationSlug,
      timezone: "Asia/Manila",
      taxRate: 1200, // 12% VAT
      taxLabel: "VAT",
      currency: "PHP",
      operatingHours: {
        monday: { open: "07:00", close: "21:00" },
        tuesday: { open: "07:00", close: "21:00" },
        wednesday: { open: "07:00", close: "21:00" },
        thursday: { open: "07:00", close: "21:00" },
        friday: { open: "07:00", close: "21:00" },
        saturday: { open: "07:00", close: "21:00" },
        sunday: { open: "07:00", close: "21:00" },
      },
      status: "active",
      updatedAt: now,
    });

    const adminId = await ctx.runMutation(api.seedHelpers.insertUser, {
      tenantId,
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: "owner",
      status: "active",
      updatedAt: now,
    });

    await ctx.runMutation(api.seedHelpers.insertUserLocation, {
      userId: adminId,
      locationId,
      tenantId,
    });

    return {
      alreadySeeded: false as const,
      tenantId,
      locationId,
      adminId,
      loginEmail: adminEmail,
      // Echo back so the operator confirms what was set; do NOT log the
      // password in production server logs in the future.
      passwordSet: true,
      reminder:
        "First login uses the bootstrap password — change it from Settings → Account before going live.",
    };
  },
});
