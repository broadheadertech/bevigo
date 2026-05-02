import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, AuthContext } from "../lib/auth";
import { Id } from "../_generated/dataModel";

export const listOrderHistory = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
    status: v.optional(
      v.union(v.literal("completed"), v.literal("voided"), v.literal("refunded"))
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
    paymentType: v.optional(
      v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet"))
    ),
    searchQuery: v.optional(v.string()),
    /** When true, restrict the result to orders rung up by the caller. */
    mineOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["barista", "owner", "manager"]);
    // Baristas always see only their own history regardless of the flag —
    // managers and owners can pivot via mineOnly.
    const restrictToSelf =
      session.role === "barista" || args.mineOnly === true;

    const locationIds = getLocationScope(session, args.locationId);
    const limit = args.limit ?? 50;

    const allOrders: Array<{
      _id: Id<"orders">;
      orderNumber: string;
      completedAt: number;
      subtotal: number;
      total: number;
      paymentType: string;
      payments?: Array<{ type: string; amount: number }>;
      itemCount: number;
      status: string;
      baristaName: string;
      locationId: Id<"locations">;
      customerName: string | null;
      customerId: Id<"customers"> | null;
      tableName: string | null;
      discountAmount: number | null;
      discountReason: string | null;
      discountType: string | null;
      discountValue: number | null;
      taxAmount: number;
      taxRate: number;
      taxLabel: string;
      refundedAt: number | null;
      refundedBy: Id<"users"> | null;
      refundedByName: string | null;
      refundReason: string | null;
      refundAmount: number | null;
    }> = [];

    for (const locId of locationIds) {
      // When filtering for "refunded", we still query "completed" orders (refunded orders keep completed status)
      const wantRefunded = args.status === "refunded";
      const wantCompleted = !args.status || args.status === "completed" || wantRefunded;
      const wantVoided = !args.status || args.status === "voided";

      const completedOrders = wantCompleted
        ? await ctx.db
            .query("orders")
            .withIndex("by_tenant_location_status", (q: any) =>
              q
                .eq("tenantId", session.tenantId)
                .eq("locationId", locId)
                .eq("status", "completed")
            )
            .collect()
        : [];

      const voidedOrders = wantVoided
        ? await ctx.db
            .query("orders")
            .withIndex("by_tenant_location_status", (q: any) =>
              q
                .eq("tenantId", session.tenantId)
                .eq("locationId", locId)
                .eq("status", "voided")
            )
            .collect()
        : [];

      const combined = [...completedOrders, ...voidedOrders];

      for (const order of combined) {
        const orderTime = order.completedAt ?? order._creationTime;

        // Per-operator scope (set above)
        if (restrictToSelf && order.userId !== session.userId) continue;

        // Date range filter
        if (args.startDate != null && orderTime < args.startDate) continue;
        if (args.endDate != null && orderTime > args.endDate) continue;

        // Payment type filter
        if (args.paymentType && order.paymentType !== args.paymentType) continue;

        // Refunded filter: only show orders with refund data
        if (wantRefunded && !order.refundedAt) continue;

        // If status is "completed" (not refunded filter), exclude refunded orders
        if (args.status === "completed" && order.refundedAt) continue;

        // Search by order number
        if (args.searchQuery) {
          const q = args.searchQuery.toLowerCase();
          const orderNum = (order.orderNumber ?? "").toLowerCase();
          if (!orderNum.includes(q)) continue;
        }

        // Count items
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q: any) => q.eq("orderId", order._id))
          .collect();

        // Get barista name
        const user = await ctx.db.get(order.userId);
        const baristaName = user?.name ?? "Unknown";

        // Get customer name if linked
        let customerName: string | null = null;
        if (order.customerId) {
          const customer = await ctx.db.get(order.customerId);
          customerName = customer?.name ?? null;
        }

        // Get refunder name if refunded
        let refundedByName: string | null = null;
        if (order.refundedBy) {
          const refunder = await ctx.db.get(order.refundedBy);
          refundedByName = refunder?.name ?? null;
        }

        allOrders.push({
          _id: order._id,
          orderNumber: order.orderNumber ?? "",
          completedAt: orderTime,
          subtotal: order.subtotal,
          total: order.total,
          paymentType: order.paymentType ?? "cash",
          payments: order.payments as Array<{ type: string; amount: number }> | undefined,
          itemCount: items.length,
          status: order.status,
          baristaName,
          locationId: order.locationId,
          customerName,
          customerId: order.customerId ?? null,
          tableName: order.tableName ?? null,
          discountAmount: order.discountAmount ?? null,
          discountReason: order.discountReason ?? null,
          discountType: order.discountType ?? null,
          discountValue: order.discountValue ?? null,
          taxAmount: order.taxAmount,
          taxRate: order.taxRate,
          taxLabel: order.taxLabel,
          refundedAt: order.refundedAt ?? null,
          refundedBy: order.refundedBy ?? null,
          refundedByName,
          refundReason: order.refundReason ?? null,
          refundAmount: order.refundAmount ?? null,
        });
      }
    }

    // Sort by completedAt descending
    allOrders.sort(
      (a: { completedAt: number }, b: { completedAt: number }) =>
        b.completedAt - a.completedAt
    );

    return allOrders.slice(0, limit);
  },
});

function getLocationScope(
  session: AuthContext,
  locationId?: Id<"locations">
): Id<"locations">[] {
  if (locationId) {
    if (session.role !== "owner" && !session.locationIds.includes(locationId)) {
      throw new Error("Forbidden: no access to this location");
    }
    return [locationId];
  }
  if (session.role === "manager") {
    return session.locationIds;
  }
  return session.locationIds;
}

/**
 * Same scope as listOrderHistory but flattened to one row per ORDER ITEM,
 * with the order context (date, order #, cashier, customer, status,
 * payment) repeated on each row. Used by the Sales Ledger export so the
 * CSV captures the exact items rung up in each transaction. Modifiers for
 * each line are joined into a single string for spreadsheet readability.
 */
export const listOrderHistoryLineItems = query({
  args: {
    token: v.string(),
    locationId: v.optional(v.id("locations")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
    paymentType: v.optional(
      v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet"))
    ),
    mineOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const restrictToSelf =
      session.role === "barista" || args.mineOnly === true;
    const locationIds = getLocationScope(session, args.locationId);
    const limit = args.limit ?? 500;

    type Row = {
      orderId: Id<"orders">;
      orderNumber: string;
      completedAt: number;
      status: string;
      isRefunded: boolean;
      paymentType: string;
      baristaName: string;
      customerName: string | null;
      tableName: string | null;
      itemName: string;
      modifiers: string;
      quantity: number;
      unitPrice: number;
      lineSubtotal: number;
      orderSubtotal: number;
      orderDiscount: number;
      orderTax: number;
      orderTotal: number;
    };

    const rows: Row[] = [];

    for (const locId of locationIds) {
      const completed = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q: any) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "completed")
        )
        .collect();
      const voided = await ctx.db
        .query("orders")
        .withIndex("by_tenant_location_status", (q: any) =>
          q
            .eq("tenantId", session.tenantId)
            .eq("locationId", locId)
            .eq("status", "voided")
        )
        .collect();

      const all = [...completed, ...voided];

      for (const order of all) {
        const t = order.completedAt ?? order._creationTime;
        if (restrictToSelf && order.userId !== session.userId) continue;
        if (args.startDate != null && t < args.startDate) continue;
        if (args.endDate != null && t > args.endDate) continue;
        if (args.paymentType && order.paymentType !== args.paymentType) continue;

        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q: any) => q.eq("orderId", order._id))
          .collect();

        const user = await ctx.db.get(order.userId);
        let customerName: string | null = null;
        if (order.customerId) {
          const customer = await ctx.db.get(order.customerId);
          customerName = customer?.name ?? null;
        }

        for (const it of items) {
          const mods = await ctx.db
            .query("orderItemModifiers")
            .withIndex("by_order_item", (q: any) => q.eq("orderItemId", it._id))
            .collect();
          const modString = mods
            .map((m) =>
              m.priceAdjustment > 0
                ? `${m.modifierName} (+${(m.priceAdjustment / 100).toFixed(2)})`
                : m.modifierName
            )
            .join("; ");

          const unitPrice = it.basePrice;
          const lineSubtotal = it.subtotal;

          rows.push({
            orderId: order._id,
            orderNumber: order.orderNumber ?? "",
            completedAt: t,
            status: order.status,
            isRefunded: !!order.refundedAt,
            paymentType: order.paymentType ?? "",
            baristaName: user?.name ?? "Unknown",
            customerName,
            tableName: order.tableName ?? null,
            itemName: it.itemName,
            modifiers: modString,
            quantity: it.quantity,
            unitPrice,
            lineSubtotal,
            orderSubtotal: order.subtotal,
            orderDiscount: order.discountAmount ?? 0,
            orderTax: order.taxAmount,
            orderTotal: order.total,
          });
        }
      }
    }

    rows.sort(
      (a, b) =>
        b.completedAt - a.completedAt ||
        a.orderNumber.localeCompare(b.orderNumber)
    );
    return rows.slice(0, limit);
  },
});
