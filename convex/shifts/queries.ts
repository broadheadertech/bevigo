import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { Doc, Id } from "../_generated/dataModel";

export const getActiveShift = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const activeShifts = await ctx.db
      .query("shifts")
      .withIndex("by_tenant_location_status", (q) =>
        q
          .eq("tenantId", session.tenantId)
          .eq("locationId", args.locationId)
          .eq("status", "active")
      )
      .collect();

    const userShift = activeShifts.find(
      (s: Doc<"shifts">) => s.userId === session.userId
    );

    return userShift ?? null;
  },
});

export const listShifts = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);

    const effectiveLimit = args.limit ?? 50;

    let shifts: Doc<"shifts">[];

    if (args.locationId) {
      shifts = await ctx.db
        .query("shifts")
        .withIndex("by_tenant_location", (q) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", args.locationId as Id<"locations">)
        )
        .order("desc")
        .take(effectiveLimit);
    } else {
      shifts = await ctx.db
        .query("shifts")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .order("desc")
        .take(effectiveLimit);
    }

    // Enrich with user names and order data
    const enriched = await Promise.all(
      shifts.map(async (shift: Doc<"shifts">) => {
        const user = await ctx.db.get(shift.userId);

        // Count orders during this shift
        const orders = await ctx.db
          .query("orders")
          .withIndex("by_tenant_location", (q) =>
            q
              .eq("tenantId", session.tenantId)
              .eq("locationId", shift.locationId)
          )
          .collect();

        const shiftOrders = orders.filter(
          (o: Doc<"orders">) =>
            o.status === "completed" &&
            o.completedAt !== undefined &&
            o.completedAt! >= shift.startedAt &&
            (shift.endedAt === undefined || o.completedAt! <= shift.endedAt!)
        );

        const orderCount = shiftOrders.length;
        const totalRevenue = shiftOrders.reduce(
          (sum: number, o: Doc<"orders">) => sum + o.total,
          0
        );

        const variance =
          shift.closingCash !== undefined && shift.expectedCash !== undefined
            ? shift.closingCash - shift.expectedCash
            : undefined;

        return {
          _id: shift._id,
          locationId: shift.locationId,
          userId: shift.userId,
          userName: user?.name ?? "Unknown",
          startedAt: shift.startedAt,
          endedAt: shift.endedAt,
          openingCash: shift.openingCash,
          closingCash: shift.closingCash,
          expectedCash: shift.expectedCash,
          variance,
          orderCount,
          totalRevenue,
          status: shift.status,
          notes: shift.notes,
        };
      })
    );

    return enriched;
  },
});
