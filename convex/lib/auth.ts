import { QueryCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "../_generated/dataModel";

export type AuthContext = {
  userId: Id<"users">;
  tenantId: Id<"tenants">;
  role: "owner" | "manager" | "barista";
  locationIds: Id<"locations">[];
};

export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  token: string
): Promise<AuthContext> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new ConvexError("Unauthorized");
  }

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
