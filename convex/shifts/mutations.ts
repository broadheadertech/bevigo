import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";

export const startShift = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    openingCash: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["barista", "manager", "owner"]);
    requireLocationAccess(session, args.locationId);

    // Check no active shift for this user at this location
    const existingActive = await ctx.db
      .query("shifts")
      .withIndex("by_tenant_location_status", (q) =>
        q
          .eq("tenantId", session.tenantId)
          .eq("locationId", args.locationId)
          .eq("status", "active")
      )
      .collect();

    const userActiveShift = existingActive.find(
      (s: { userId: typeof session.userId }) => s.userId === session.userId
    );
    if (userActiveShift) {
      throw new Error("You already have an active shift at this location");
    }

    const shiftId = await ctx.db.insert("shifts", {
      tenantId: session.tenantId,
      locationId: args.locationId,
      userId: session.userId,
      startedAt: Date.now(),
      openingCash: args.openingCash,
      status: "active",
    });

    return shiftId;
  },
});

export const endShift = mutation({
  args: {
    token: v.string(),
    shiftId: v.id("shifts"),
    closingCash: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["barista", "manager", "owner"]);

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.tenantId !== session.tenantId) {
      throw new Error("Shift not found");
    }
    if (shift.status !== "active") {
      throw new Error("Shift is already closed");
    }

    // Calculate expected cash: openingCash + sum of cash-type completed orders during shift
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", shift.locationId)
      )
      .collect();

    const cashOrderTotal = orders
      .filter(
        (o: { status: string; paymentType?: string; completedAt?: number }) =>
          o.status === "completed" &&
          o.paymentType === "cash" &&
          o.completedAt !== undefined &&
          o.completedAt! >= shift.startedAt &&
          (shift.endedAt === undefined || o.completedAt! <= Date.now())
      )
      .reduce((sum: number, o: { total: number }) => sum + o.total, 0);

    const expectedCash = shift.openingCash + cashOrderTotal;
    const now = Date.now();

    await ctx.db.patch(args.shiftId, {
      status: "closed",
      endedAt: now,
      closingCash: args.closingCash,
      expectedCash,
      notes: args.notes,
    });

    return { expectedCash, variance: args.closingCash - expectedCash };
  },
});
