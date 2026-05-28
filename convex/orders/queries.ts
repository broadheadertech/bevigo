import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const getCurrentDraft = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Find the most recent draft order for this user at this location
    const drafts = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location_status", (q) =>
        q
          .eq("tenantId", session.tenantId)
          .eq("locationId", args.locationId)
          .eq("status", "draft")
      )
      .collect();

    // Filter to current user's drafts and get most recent
    const userDrafts = drafts.filter((o) => o.userId === session.userId);
    if (userDrafts.length === 0) return null;

    const order = userDrafts.sort(
      (a, b) => b._creationTime - a._creationTime
    )[0];

    // Get order items
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    // Get modifiers for each item
    const itemsWithModifiers = await Promise.all(
      items.map(async (item) => {
        const modifiers = await ctx.db
          .query("orderItemModifiers")
          .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
          .collect();
        return { ...item, modifiers };
      })
    );

    return { ...order, items: itemsWithModifiers };
  },
});

export const getOrderWithItems = query({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) return null;

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const itemsWithModifiers = await Promise.all(
      items.map(async (item) => {
        const modifiers = await ctx.db
          .query("orderItemModifiers")
          .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
          .collect();
        return { ...item, modifiers };
      })
    );

    return { ...order, items: itemsWithModifiers };
  },
});

export const getReceipt = query({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) return null;

    // Get order items with modifiers
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const itemsWithModifiers = await Promise.all(
      items.map(async (item: (typeof items)[number]) => {
        const modifiers = await ctx.db
          .query("orderItemModifiers")
          .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
          .collect();
        return {
          name: item.itemName,
          quantity: item.quantity,
          subtotal: item.subtotal,
          customerLabel: item.customerLabel,
          modifiers: modifiers.map((mod: (typeof modifiers)[number]) => ({
            name: mod.modifierName,
            priceAdj: mod.priceAdjustment,
          })),
        };
      })
    );

    // Get location info
    const location = await ctx.db.get(order.locationId);
    const locationName = location?.name ?? "Unknown Location";
    const locationAddress = location?.address ?? "";

    // Get barista (user) name
    const user = await ctx.db.get(order.userId);
    const baristaName = user?.name ?? "Unknown";

    // Customer name (optional)
    let customerName: string | undefined;
    if (order.customerId) {
      const customer = await ctx.db.get(order.customerId);
      if (customer && customer.tenantId === session.tenantId) {
        customerName = customer.name;
      }
    }

    // BIR identity — surfaced for the BIR-compliant receipt template.
    // Falls back to null/undefined values when the tenant hasn't filled
    // in Settings → BIR; the receipt component then renders the legacy
    // (pre-BIR) layout.
    const tenant = await ctx.db.get(session.tenantId);
    const bir = {
      businessName: tenant?.businessName ?? null,
      tradeName: tenant?.tradeName ?? null,
      businessAddress: tenant?.businessAddress ?? null,
      tin: tenant?.tin ?? null,
      vatStatus: tenant?.vatStatus ?? null,
      accreditedSupplierName: tenant?.accreditedSupplierName ?? null,
      accreditedSupplierAccreditation:
        tenant?.accreditedSupplierAccreditation ?? null,
      accreditedSupplierDateIssued:
        tenant?.accreditedSupplierDateIssued ?? null,
      accreditedSupplierDateValid:
        tenant?.accreditedSupplierDateValid ?? null,
      ptu: location?.birPermitNumber ?? null,
      min: location?.birMin ?? null,
      atp: location?.birAtpNumber ?? null,
      birSerial: order.birSerial ?? null,
      vatableSales: order.vatableSales ?? null,
      vatExemptSales: order.vatExemptSales ?? null,
      zeroRatedSales: order.zeroRatedSales ?? null,
      srPwdType: order.srPwdType ?? null,
      srPwdName: order.srPwdName ?? null,
      srPwdId: order.srPwdId ?? null,
    };

    return {
      orderNumber: order.orderNumber ?? "",
      completedAt: order.completedAt ?? order._creationTime,
      locationName,
      locationAddress,
      baristaName,
      paymentType: order.paymentType ?? "cash",
      payments: order.payments ?? [],
      tableName: order.tableName,
      customerName,
      customerLabel: order.customerLabel,
      items: itemsWithModifiers,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      taxRate: order.taxRate,
      taxLabel: order.taxLabel,
      total: order.total,
      discountAmount: order.discountAmount ?? 0,
      discountReason: order.discountReason ?? null,
      bir,
    };
  },
});

export const listPending = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    /** When true, return every operator's parked orders. Owners and managers
     *  can audit the whole register; baristas always see only their own. */
    includeOthers: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const drafts = await ctx.db
      .query("orders")
      .withIndex("by_tenant_location_status", (q) =>
        q
          .eq("tenantId", session.tenantId)
          .eq("locationId", args.locationId)
          .eq("status", "draft")
      )
      .collect();

    // Default visibility: operator only sees their own parked orders so two
    // cashiers sharing one tablet don't pick up each other's drafts. An
    // owner/manager can opt in to seeing everyone via includeOthers.
    const showEveryone =
      args.includeOthers === true &&
      (session.role === "owner" || session.role === "manager");
    const scoped = showEveryone
      ? drafts
      : drafts.filter((o) => o.userId === session.userId);

    // Get item counts + operator name for each order
    const ordersWithCounts = await Promise.all(
      scoped.map(async (order) => {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        const user = await ctx.db.get(order.userId);
        return {
          _id: order._id,
          userId: order.userId,
          baristaName: user?.name ?? "Unknown",
          isMine: order.userId === session.userId,
          subtotal: order.subtotal,
          itemCount: items.length,
          _creationTime: order._creationTime,
        };
      })
    );

    return ordersWithCounts;
  },
});
