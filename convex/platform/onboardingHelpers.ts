import { internalMutation, query } from "../_generated/server";
import { v } from "convex/values";
import { findPlatformSession } from "./helpers";

/**
 * Slug uniqueness check for the onboarding wizard. Public so the wizard
 * can validate live; we still rely on the unique index inside the
 * transactional insert as the source of truth.
 */
export const slugAvailable = query({
  args: { token: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) throw new Error("Unauthorized");
    const normalized = args.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      return { available: false, reason: "Slug must be lowercase letters, digits, and hyphens." };
    }
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", normalized))
      .unique();
    return existing
      ? { available: false, reason: "Slug already taken." }
      : { available: true, reason: null };
  },
});

/**
 * Owner email uniqueness check across all tenants — emails are global
 * identifiers in the login flow, so we can't have two tenants share an
 * owner email.
 */
export const ownerEmailAvailable = query({
  args: { token: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) throw new Error("Unauthorized");
    const lower = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) {
      return { available: false, reason: "Enter a valid email address." };
    }
    const hit = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", lower))
      .first();
    return hit
      ? { available: false, reason: "An account with this email already exists." }
      : { available: true, reason: null };
  },
});

/**
 * Internal: do the multi-row insert in a single transaction so a tenant
 * is never created without its first owner and location. Called from the
 * `createTenant` action after bcrypt finishes.
 */
export const insertTenantBundle = internalMutation({
  args: {
    // Tenant
    name: v.string(),
    slug: v.string(),
    currency: v.string(),
    timezone: v.string(),
    businessName: v.optional(v.string()),
    tradeName: v.optional(v.string()),
    businessAddress: v.optional(v.string()),
    tin: v.optional(v.string()),
    vatStatus: v.optional(
      v.union(v.literal("vat"), v.literal("non_vat"), v.literal("vat_exempt"))
    ),
    // First location
    locationName: v.string(),
    locationAddress: v.optional(v.string()),
    taxRate: v.number(),
    taxLabel: v.string(),
    // Owner
    ownerEmail: v.string(),
    ownerName: v.string(),
    ownerPasswordHash: v.string(),
    // Defaults
    seedSampleData: v.boolean(),
    /** Plan to seed for this tenant. We look it up by slug rather than id
     *  so the platform admin doesn't have to pass an opaque Convex id
     *  from the wizard — the wizard just sends "free" / "pro" / etc. and
     *  this mutation resolves it. Defaults to "free" when omitted so
     *  every wizard-created tenant has a working subscription row
     *  (otherwise `getEntitlements` falls back to "No Plan" forever). */
    initialPlanSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slug = args.slug.trim().toLowerCase();
    const email = args.ownerEmail.trim().toLowerCase();

    // Race-condition guard — slug + email might have been taken between
    // the wizard's pre-flight check and now.
    const slugTaken = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (slugTaken) throw new Error("Slug already taken");

    const emailTaken = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (emailTaken) throw new Error("Owner email already in use");

    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      slug,
      currency: args.currency,
      timezone: args.timezone,
      status: "active",
      businessName: args.businessName || undefined,
      tradeName: args.tradeName || undefined,
      businessAddress: args.businessAddress || undefined,
      tin: args.tin || undefined,
      vatStatus: args.vatStatus,
      updatedAt: now,
    });

    const locationId = await ctx.db.insert("locations", {
      tenantId,
      name: args.locationName,
      slug: args.locationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || "main",
      address: args.locationAddress || undefined,
      timezone: args.timezone,
      taxRate: args.taxRate,
      taxLabel: args.taxLabel,
      currency: args.currency,
      operatingHours: {
        monday: { open: "07:00", close: "21:00" },
        tuesday: { open: "07:00", close: "21:00" },
        wednesday: { open: "07:00", close: "21:00" },
        thursday: { open: "07:00", close: "21:00" },
        friday: { open: "07:00", close: "21:00" },
        saturday: { open: "08:00", close: "22:00" },
        sunday: { open: "08:00", close: "22:00" },
      },
      status: "active",
      updatedAt: now,
    });

    const userId = await ctx.db.insert("users", {
      tenantId,
      email,
      name: args.ownerName,
      passwordHash: args.ownerPasswordHash,
      role: "owner",
      status: "active",
      updatedAt: now,
    });

    await ctx.db.insert("userLocations", {
      userId,
      locationId,
      tenantId,
    });

    if (args.seedSampleData) {
      // Categories — common coffee-shop buckets.
      const categories = ["Coffee", "Non-Coffee", "Tea", "Pastries", "Merchandise"];
      for (let i = 0; i < categories.length; i++) {
        await ctx.db.insert("categories", {
          tenantId,
          name: categories[i],
          sortOrder: i,
          status: "active",
          updatedAt: now,
        });
      }

      // Discount presets — the ones every PH coffee shop needs.
      const presets: Array<{
        name: string;
        type: "percentage" | "fixed";
        value: number;
        reason: string;
        requiresAuth: boolean;
      }> = [
        {
          name: "Senior / PWD",
          type: "percentage",
          value: 20,
          reason: "Senior/PWD discount (BIR-mandated)",
          requiresAuth: false,
        },
        {
          name: "Staff 50%",
          type: "percentage",
          value: 50,
          reason: "Staff comp",
          requiresAuth: true,
        },
        {
          name: "Loyalty ₱20 off",
          type: "fixed",
          value: 2000,
          reason: "Loyalty reward",
          requiresAuth: false,
        },
      ];
      for (let i = 0; i < presets.length; i++) {
        await ctx.db.insert("discountPresets", {
          tenantId,
          ...presets[i],
          status: "active",
          sortOrder: i,
          updatedAt: now,
        });
      }
    }

    // Seed the subscription row. We look up the requested plan by slug;
    // when missing (no seeded plans, or unknown slug) we fall back to
    // "free", and if even that's not seeded we skip the insert. The
    // entitlements query then treats the tenant as planless — but at
    // least the operator sees "No Plan" in Settings → White-Label and
    // can pick a real one later.
    const slugWanted = (args.initialPlanSlug ?? "free").toLowerCase();
    let plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_slug", (q) => q.eq("slug", slugWanted))
      .unique();
    if (!plan && slugWanted !== "free") {
      plan = await ctx.db
        .query("subscriptionPlans")
        .withIndex("by_slug", (q) => q.eq("slug", "free"))
        .unique();
    }
    if (plan) {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      await ctx.db.insert("tenantSubscriptions", {
        tenantId,
        planId: plan._id,
        status: "trial",
        currentPeriodStart: now,
        currentPeriodEnd: now + monthMs,
        monthlyOrderCount: 0,
        updatedAt: now,
      });
    }

    return { tenantId, locationId, userId, planSlug: plan?.slug ?? null };
  },
});
