import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { findPlatformSession } from "./helpers";

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) return null;

    let currentTenantName: string | null = null;
    if (found.session.currentTenantId) {
      const t = await ctx.db.get(found.session.currentTenantId);
      currentTenantName = t?.name ?? null;
    }

    return {
      adminId: found.admin._id,
      email: found.admin.email,
      name: found.admin.name,
      expiresAt: found.session.expiresAt,
      currentTenantId: found.session.currentTenantId ?? null,
      currentTenantName,
    };
  },
});

/**
 * List every tenant in the system. Available only to authenticated
 * platform admins.
 */
export const listTenants = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) throw new Error("Unauthorized");

    const tenants = await ctx.db.query("tenants").collect();
    const enriched = await Promise.all(
      tenants.map(async (t) => {
        const userCount = (
          await ctx.db
            .query("users")
            .withIndex("by_tenant", (q) => q.eq("tenantId", t._id))
            .collect()
        ).length;
        const locationCount = (
          await ctx.db
            .query("locations")
            .withIndex("by_tenant", (q) => q.eq("tenantId", t._id))
            .collect()
        ).length;
        return {
          _id: t._id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          userCount,
          locationCount,
        };
      })
    );
    enriched.sort((a, b) => a.name.localeCompare(b.name));
    return enriched;
  },
});

export const switchTenant = mutation({
  args: { token: v.string(), tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) throw new Error("Unauthorized");

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");

    await ctx.db.patch(found.session._id, { currentTenantId: args.tenantId });
    return { tenantId: args.tenantId, tenantName: tenant.name };
  },
});

export const exitTenant = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (!found) return;
    await ctx.db.patch(found.session._id, { currentTenantId: undefined });
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const found = await findPlatformSession(ctx, args.token);
    if (found) await ctx.db.delete(found.session._id);
  },
});
