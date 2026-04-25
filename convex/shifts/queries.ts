import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";
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

/**
 * Aggregate completed orders within a window into report totals.
 *
 * - itemCount counts non-refunded completed orders.
 * - cashTotal includes the cash portion of split payments.
 * - refundedCount / refundedAmount surface refunds whose `refundedAt` falls
 *   inside the window — those orders may have completed earlier.
 */
function summarizeOrders(
  orders: Doc<"orders">[],
  windowStart: number,
  windowEnd: number
) {
  let itemCount = 0;
  let grossTotal = 0;
  let netTotal = 0;
  let taxTotal = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let ewalletTotal = 0;
  let refundedCount = 0;
  let refundedAmount = 0;

  for (const o of orders) {
    if (o.status !== "completed") continue;
    if (o.completedAt === undefined) continue;
    if (o.completedAt < windowStart || o.completedAt > windowEnd) continue;

    if (o.refundedAt && o.refundedAt >= windowStart && o.refundedAt <= windowEnd) {
      refundedCount++;
      refundedAmount += o.refundAmount ?? o.total;
      // Refunded orders are excluded from gross/net for this window
      continue;
    }

    itemCount++;
    grossTotal += o.total;
    taxTotal += o.taxAmount;
    netTotal += o.total - o.taxAmount;

    if (o.payments && o.payments.length > 0) {
      for (const p of o.payments) {
        if (p.type === "cash") cashTotal += p.amount;
        else if (p.type === "card") cardTotal += p.amount;
        else if (p.type === "ewallet") ewalletTotal += p.amount;
      }
    } else if (o.paymentType === "cash") cashTotal += o.total;
    else if (o.paymentType === "card") cardTotal += o.total;
    else if (o.paymentType === "ewallet") ewalletTotal += o.total;
  }

  return {
    itemCount,
    grossTotal,
    netTotal,
    taxTotal,
    cashTotal,
    cardTotal,
    ewalletTotal,
    refundedCount,
    refundedAmount,
  };
}

/**
 * X reading — live snapshot of the operator's currently-active shift.
 *
 * Includes orders rung up between shift start and now. Does NOT close the
 * shift; can be re-run as many times as the operator likes.
 */
export const getShiftReport = query({
  args: {
    token: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["barista", "manager", "owner"]);

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.tenantId !== session.tenantId) {
      throw new Error("Shift not found");
    }

    // Baristas can only view their own shift; managers/owners can view any
    // shift at a location they have access to.
    if (session.role === "barista" && shift.userId !== session.userId) {
      throw new Error("Not authorized to view this shift");
    }
    if (session.role === "manager") {
      requireLocationAccess(session, shift.locationId);
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", shift.locationId)
      )
      .collect();

    const myOrders = orders.filter((o: Doc<"orders">) => o.userId === shift.userId);
    const windowEnd = shift.endedAt ?? Date.now();
    const summary = summarizeOrders(myOrders, shift.startedAt, windowEnd);

    const expectedCash = shift.openingCash + summary.cashTotal;
    const variance =
      shift.closingCash !== undefined ? shift.closingCash - expectedCash : null;

    const user = await ctx.db.get(shift.userId);
    const location = await ctx.db.get(shift.locationId);

    return {
      kind: shift.status === "active" ? ("X" as const) : ("Y" as const),
      shiftId: shift._id,
      status: shift.status,
      userName: user?.name ?? "Unknown",
      locationName: location?.name ?? "Unknown",
      startedAt: shift.startedAt,
      endedAt: shift.endedAt,
      generatedAt: Date.now(),
      openingCash: shift.openingCash,
      closingCash: shift.closingCash ?? null,
      expectedCash,
      variance,
      ...summary,
    };
  },
});

/**
 * Z reading — daily total at this location.
 *
 * `dayStart` is a midnight epoch millis; the window is [dayStart, dayStart + 24h).
 * Defaults to today (caller's clock) when omitted.
 *
 * `userId` optionally narrows the report to a single operator's day. Baristas
 * are always restricted to their own user; only owners/managers may pass
 * another userId or omit it entirely (everyone).
 */
export const getDailyReport = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    dayStart: v.optional(v.number()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["barista", "manager", "owner"]);
    requireLocationAccess(session, args.locationId);

    const targetUserId =
      session.role === "barista" ? session.userId : args.userId;

    const dayStart =
      args.dayStart ??
      (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", args.locationId)
      )
      .collect();

    const scopedOrders = targetUserId
      ? orders.filter((o: Doc<"orders">) => o.userId === targetUserId)
      : orders;
    const summary = summarizeOrders(scopedOrders, dayStart, dayEnd);

    // Shifts whose work overlaps the window — useful context on the report.
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_tenant_location", (q) =>
        q.eq("tenantId", session.tenantId).eq("locationId", args.locationId)
      )
      .collect();
    const shiftsInWindow = shifts.filter((s: Doc<"shifts">) => {
      if (targetUserId && s.userId !== targetUserId) return false;
      const end = s.endedAt ?? Date.now();
      return end >= dayStart && s.startedAt <= dayEnd;
    });

    const location = await ctx.db.get(args.locationId);
    const targetUser = targetUserId ? await ctx.db.get(targetUserId) : null;

    return {
      kind: "Z" as const,
      locationName: location?.name ?? "Unknown",
      scope: targetUserId ? ("user" as const) : ("everyone" as const),
      userName: targetUser?.name ?? null,
      dayStart,
      dayEnd,
      generatedAt: Date.now(),
      shiftCount: shiftsInWindow.length,
      ...summary,
    };
  },
});
