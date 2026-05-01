import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Internal: find user by email across all tenants.
//
// Case- and whitespace-insensitive: tries the by_email index for the
// trimmed/lowercased email first (fast path for new users we normalize on
// write), then for the raw input (covers users registered before
// normalization), then a full scan for legacy mixed-case rows.
export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const raw = args.email.trim();
    const lower = raw.toLowerCase();

    const tryIndex = async (email: string) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

    let user = await tryIndex(lower);
    if (!user && raw !== lower) user = await tryIndex(raw);
    if (user) return user;

    // Legacy fallback: scan for case-insensitive match. Costly only for the
    // rare case where the email was stored with mixed case before we
    // started normalizing. Once a user logs in we re-normalize on the next
    // write path; in practice this scan happens at most once per old user.
    const candidates = await ctx.db.query("users").collect();
    return candidates.find((u) => (u.email ?? "").toLowerCase() === lower) ?? null;
  },
});

// Internal: create a new tenant + owner user
export const createOwnerWithTenant = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    shopName: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const tenantId = await ctx.db.insert("tenants", {
      name: args.shopName,
      slug: args.shopName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      currency: "PHP",
      timezone: "Asia/Manila",
      status: "active",
      updatedAt: now,
    });

    const userId = await ctx.db.insert("users", {
      tenantId,
      email: args.email.trim().toLowerCase(),
      name: args.name,
      passwordHash: args.passwordHash,
      role: "owner",
      status: "active",
      updatedAt: now,
    });

    const locationId = await ctx.db.insert("locations", {
      tenantId,
      name: "Main Branch",
      slug: "main",
      timezone: "Asia/Manila",
      taxRate: 1200,
      taxLabel: "VAT",
      currency: "PHP",
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

    await ctx.db.insert("userLocations", {
      userId,
      locationId,
      tenantId,
    });

    return { userId, tenantId, locationId };
  },
});
