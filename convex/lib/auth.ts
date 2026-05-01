import { QueryCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "../_generated/dataModel";

export type AuthContext = {
  userId: Id<"users">;
  tenantId: Id<"tenants">;
  role: "owner" | "manager" | "barista";
  locationIds: Id<"locations">[];
  /** True when the caller is a platform admin impersonating this tenant.
   *  Use it to gate audit-log entries or hide certain UI affordances. */
  isPlatformAdmin?: boolean;
  platformAdminId?: Id<"platformAdmins">;
};

export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  token: string
): Promise<AuthContext> {
  // 1. Tenant-scoped session (regular owner / manager / barista).
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (session && session.expiresAt >= Date.now()) {
    const user = await ctx.db.get(session.userId);
    if (!user || user.status !== "active") {
      throw new ConvexError("Unauthorized");
    }

    const userLocations = await ctx.db
      .query("userLocations")
      .withIndex("by_user", (q) => q.eq("userId", session.userId))
      .collect();

    return {
      userId: session.userId,
      tenantId: session.tenantId,
      role: user.role,
      locationIds: userLocations.map((ul) => ul.locationId),
    };
  }

  // 2. Platform-admin session impersonating a tenant. Same token shape so
  //    the dashboard cookie can flow through unchanged. We materialise an
  //    AuthContext that looks like an owner of the picked tenant, with
  //    every location in scope, and flag isPlatformAdmin so callers can
  //    distinguish in audit logs.
  const platformSession = await ctx.db
    .query("platformSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (
    platformSession &&
    platformSession.expiresAt >= Date.now() &&
    platformSession.currentTenantId
  ) {
    const admin = await ctx.db.get(platformSession.platformAdminId);
    if (!admin || admin.status !== "active") {
      throw new ConvexError("Unauthorized");
    }
    const tenant = await ctx.db.get(platformSession.currentTenantId);
    if (!tenant) throw new ConvexError("Unauthorized");

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    // Find any owner user inside the tenant — we re-use their userId so
    // foreign keys (audit, sessions, etc.) stay valid. Falls back to the
    // first user in the tenant if no owner exists. If the tenant is empty
    // we still synthesize a context but operations that require a real
    // userId (orders, audit) will refuse.
    const owners = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();
    const stand = owners.find((u) => u.role === "owner") ?? owners[0];
    if (!stand) throw new ConvexError("Tenant has no users yet");

    return {
      userId: stand._id,
      tenantId: tenant._id,
      role: "owner",
      locationIds: locations.map((l) => l._id),
      isPlatformAdmin: true,
      platformAdminId: admin._id,
    };
  }

  throw new ConvexError("Unauthorized");
}

export function requireRole(
  auth: AuthContext,
  allowedRoles: AuthContext["role"][]
): void {
  if (!allowedRoles.includes(auth.role)) {
    throw new ConvexError("Forbidden: insufficient permissions");
  }
}

export function requireLocationAccess(
  auth: AuthContext,
  locationId: Id<"locations">
): void {
  if (auth.role === "owner") return;

  if (!auth.locationIds.includes(locationId)) {
    throw new ConvexError("Forbidden: no access to this location");
  }
}
