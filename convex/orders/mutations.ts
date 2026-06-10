import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { addStampInternal } from "../customers/mutations";
import { earnPointsInternal } from "../points/mutations";
import { issueBirSerial } from "../settings/bir";
import { consumePreallocatedSerial } from "../settings/birReservations";

export const createDraftOrder = mutation({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    tableId: v.optional(v.id("tables")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Validate location belongs to tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    // If tableId provided, look up table name for denormalization
    let tableName: string | undefined;
    if (args.tableId) {
      const table = await ctx.db.get(args.tableId);
      if (!table || table.tenantId !== session.tenantId) {
        throw new Error("Table not found");
      }
      tableName = table.name;
    }

    const orderId = await ctx.db.insert("orders", {
      tenantId: session.tenantId,
      locationId: args.locationId,
      userId: session.userId,
      status: "draft",
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      taxRate: location.taxRate,
      taxLabel: location.taxLabel,
      tableId: args.tableId,
      tableName,
      updatedAt: Date.now(),
    });

    return orderId;
  },
});

export const addItemToOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    menuItemId: v.id("menuItems"),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only add items to draft orders");
    }

    // Get menu item
    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem || menuItem.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Check for location price override
    const override = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", args.menuItemId).eq("locationId", order.locationId)
      )
      .unique();

    const effectivePrice = override?.price ?? menuItem.basePrice;
    const qty = args.quantity ?? 1;

    // Create order item with denormalized snapshot
    const orderItemId = await ctx.db.insert("orderItems", {
      orderId: args.orderId,
      menuItemId: args.menuItemId,
      tenantId: session.tenantId,
      itemName: menuItem.name,
      basePrice: effectivePrice,
      quantity: qty,
      subtotal: effectivePrice * qty,
    });

    // Recalculate order totals
    await recalculateOrderTotals(ctx, args.orderId);

    return orderItemId;
  },
});

export const addItemWithModifiers = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    menuItemId: v.id("menuItems"),
    modifiers: v.array(
      v.object({
        modifierName: v.string(),
        priceAdjustment: v.number(),
      })
    ),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only add items to draft orders");
    }

    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem || menuItem.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Check for location price override
    const override = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", args.menuItemId).eq("locationId", order.locationId)
      )
      .unique();

    const effectivePrice = override?.price ?? menuItem.basePrice;
    const qty = args.quantity ?? 1;

    // Calculate modifier adjustments
    const modifierTotal = args.modifiers.reduce(
      (sum, m) => sum + m.priceAdjustment,
      0
    );
    const itemTotal = (effectivePrice + modifierTotal) * qty;

    // Create order item
    const orderItemId = await ctx.db.insert("orderItems", {
      orderId: args.orderId,
      menuItemId: args.menuItemId,
      tenantId: session.tenantId,
      itemName: menuItem.name,
      basePrice: effectivePrice,
      quantity: qty,
      subtotal: itemTotal,
    });

    // Create modifier records
    for (const mod of args.modifiers) {
      await ctx.db.insert("orderItemModifiers", {
        orderItemId,
        tenantId: session.tenantId,
        modifierName: mod.modifierName,
        priceAdjustment: mod.priceAdjustment,
      });
    }

    // Recalculate order totals
    await recalculateOrderTotals(ctx, args.orderId);

    return orderItemId;
  },
});

export const addItemWithDefaults = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    menuItemId: v.id("menuItems"),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only add items to draft orders");
    }

    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem || menuItem.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    const assignments = await ctx.db
      .query("menuItemModifierGroups")
      .withIndex("by_menu_item", (q) => q.eq("menuItemId", args.menuItemId))
      .collect();

    const chosen: Array<{ modifierName: string; priceAdjustment: number }> = [];
    const missingRequired: string[] = [];

    for (const a of assignments) {
      const group = await ctx.db.get(a.modifierGroupId);
      if (!group) continue;
      const options = await ctx.db
        .query("modifiers")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      const activeOptions = options.filter((o) => o.status === "active");
      const defaults = activeOptions.filter((o) => o.isDefault);

      if (defaults.length > 0) {
        for (const d of defaults) {
          chosen.push({
            modifierName: d.name,
            priceAdjustment: d.priceAdjustment,
          });
        }
      } else if (group.required && group.minSelect > 0) {
        missingRequired.push(group.name);
      }
    }

    if (missingRequired.length > 0) {
      // Return — don't throw — so the dev console isn't spammed with a
      // "Server Error" for every required-customization prompt. The client
      // checks `result.needsCustomization` and opens the modifier modal.
      return {
        needsCustomization: true as const,
        groups: missingRequired,
      };
    }

    const override = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", args.menuItemId).eq("locationId", order.locationId)
      )
      .unique();
    const effectivePrice = override?.price ?? menuItem.basePrice;
    const qty = args.quantity ?? 1;

    const modifierTotal = chosen.reduce((s, m) => s + m.priceAdjustment, 0);
    const itemTotal = (effectivePrice + modifierTotal) * qty;

    const orderItemId = await ctx.db.insert("orderItems", {
      orderId: args.orderId,
      menuItemId: args.menuItemId,
      tenantId: session.tenantId,
      itemName: menuItem.name,
      basePrice: effectivePrice,
      quantity: qty,
      subtotal: itemTotal,
    });

    for (const mod of chosen) {
      await ctx.db.insert("orderItemModifiers", {
        orderItemId,
        tenantId: session.tenantId,
        modifierName: mod.modifierName,
        priceAdjustment: mod.priceAdjustment,
      });
    }

    await recalculateOrderTotals(ctx, args.orderId);
    return { needsCustomization: false as const, orderItemId };
  },
});

export const setOrderLabel = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    customerLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    const trimmed = args.customerLabel.trim().slice(0, 40);
    await ctx.db.patch(args.orderId, {
      customerLabel: trimmed.length > 0 ? trimmed : undefined,
      updatedAt: Date.now(),
    });
  },
});

export const setItemLabel = mutation({
  args: {
    token: v.string(),
    orderItemId: v.id("orderItems"),
    customerLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const item = await ctx.db.get(args.orderItemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Order item not found");
    }
    const trimmed = args.customerLabel.trim().slice(0, 40); // sticker has limited width
    await ctx.db.patch(args.orderItemId, {
      customerLabel: trimmed.length > 0 ? trimmed : undefined,
    });
  },
});

export const removeItemFromOrder = mutation({
  args: {
    token: v.string(),
    orderItemId: v.id("orderItems"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const orderItem = await ctx.db.get(args.orderItemId);
    if (!orderItem || orderItem.tenantId !== session.tenantId) {
      throw new Error("Order item not found");
    }

    const order = await ctx.db.get(orderItem.orderId);
    if (!order || order.status !== "draft") {
      throw new Error("Can only remove items from draft orders");
    }

    // Delete modifiers first
    const modifiers = await ctx.db
      .query("orderItemModifiers")
      .withIndex("by_order_item", (q) => q.eq("orderItemId", args.orderItemId))
      .collect();
    for (const mod of modifiers) {
      await ctx.db.delete(mod._id);
    }

    // Delete the order item
    await ctx.db.delete(args.orderItemId);

    // Check if order has any remaining items
    const remainingItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderItem.orderId))
      .collect();

    if (remainingItems.length === 0) {
      // Abandon the order
      await ctx.db.patch(orderItem.orderId, {
        status: "abandoned",
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        updatedAt: Date.now(),
      });
    } else {
      await recalculateOrderTotals(ctx, orderItem.orderId);
    }

    return orderItem.orderId;
  },
});

export const updateItemModifiers = mutation({
  args: {
    token: v.string(),
    orderItemId: v.id("orderItems"),
    modifiers: v.array(
      v.object({
        modifierName: v.string(),
        priceAdjustment: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const orderItem = await ctx.db.get(args.orderItemId);
    if (!orderItem || orderItem.tenantId !== session.tenantId) {
      throw new Error("Order item not found");
    }

    const order = await ctx.db.get(orderItem.orderId);
    if (!order || order.status !== "draft") {
      throw new Error("Can only modify items on draft orders");
    }

    // Delete existing modifiers for this item
    const existingModifiers = await ctx.db
      .query("orderItemModifiers")
      .withIndex("by_order_item", (q) => q.eq("orderItemId", args.orderItemId))
      .collect();
    for (const mod of existingModifiers) {
      await ctx.db.delete(mod._id);
    }

    // Insert new modifiers
    for (const mod of args.modifiers) {
      await ctx.db.insert("orderItemModifiers", {
        orderItemId: args.orderItemId,
        tenantId: session.tenantId,
        modifierName: mod.modifierName,
        priceAdjustment: mod.priceAdjustment,
      });
    }

    // Recalculate item subtotal
    const modifierTotal = args.modifiers.reduce(
      (sum, m) => sum + m.priceAdjustment,
      0
    );
    const itemSubtotal =
      (orderItem.basePrice + modifierTotal) * orderItem.quantity;
    await ctx.db.patch(args.orderItemId, { subtotal: itemSubtotal });

    // Recalculate order totals
    await recalculateOrderTotals(ctx, orderItem.orderId);

    return args.orderItemId;
  },
});

export const abandonOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only cancel draft orders");
    }

    // Delete all order items and their modifiers
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    for (const item of items) {
      const modifiers = await ctx.db
        .query("orderItemModifiers")
        .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
        .collect();
      for (const mod of modifiers) {
        await ctx.db.delete(mod._id);
      }
      await ctx.db.delete(item._id);
    }

    await ctx.db.patch(args.orderId, {
      status: "abandoned",
      updatedAt: Date.now(),
    });
  },
});

export const completeOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    paymentType: v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet"), v.literal("split")),
    payments: v.optional(v.array(v.object({
      type: v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet")),
      amount: v.number(),
      tendered: v.optional(v.number()),
      change: v.optional(v.number()),
    }))),
    cashTendered: v.optional(v.number()), // for single-cash payments
    /**
     * Pre-allocated BIR serial — offline mode hands the server back the
     * exact serial number the receipt printed. The server validates it
     * against an active reservation (range + ownership + not-yet-used)
     * and consumes it; if validation fails we fall back to issuing a
     * fresh serial from the counter so the order still completes.
     */
    clientBirSerial: v.optional(
      v.object({
        reservationId: v.id("orderSerialReservations"),
        serialNumber: v.number(),
        deviceId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    // Idempotency guard. If a previous completeOrder call already
    // committed this draft but the response never reached the client,
    // the offline-queue replay (or a manual retry) will send the same
    // args again. Without this, we'd throw → the queue would dead-letter
    // a payment that actually settled, or in the worst case we'd burn a
    // second BIR serial and double-deduct stock. The orderId is the
    // natural idempotency key — one draft, one completion.
    if (order.status === "completed" && order.orderNumber) {
      return {
        orderId: args.orderId,
        orderNumber: order.orderNumber,
        total: order.total,
      };
    }
    if (order.status !== "draft") {
      throw new Error("Can only complete draft orders");
    }

    // Validate order has at least one item
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    if (items.length === 0) {
      throw new Error("Cannot complete an order with no items");
    }

    // Read location for latest tax info
    const location = await ctx.db.get(order.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    // Recalculate totals from items
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

    // Account for discount
    let finalDiscountAmount = order.discountAmount ?? 0;
    if (order.discountType === "percentage" && order.discountValue) {
      finalDiscountAmount = Math.round(subtotal * order.discountValue / 100);
    }
    if (finalDiscountAmount > subtotal) {
      finalDiscountAmount = subtotal;
    }

    // BIR VAT breakdown.
    //   - Senior/PWD orders: the whole sale is VAT-exempt AND gets 20%
    //     off the net-of-VAT amount. (RA 9994 / RA 10754)
    //   - Regular orders: tax is added on top of the discounted subtotal.
    // Math is in cents throughout to avoid rounding error.
    const isSrPwd = !!order.srPwdType;
    let taxAmount: number;
    let total: number;
    let vatableSales = 0;
    let vatExemptSales = 0;
    const zeroRatedSales = 0;

    if (isSrPwd) {
      // Strip the implicit VAT out of the subtotal, then 20% off the
      // net. No VAT charged on the line. Discount stored = the 20%.
      const netOfVat = Math.round((subtotal * 100) / 112);
      const srPwdDiscount = Math.round(netOfVat * 0.2);
      finalDiscountAmount = srPwdDiscount;
      total = netOfVat - srPwdDiscount;
      taxAmount = 0;
      vatExemptSales = total;
    } else {
      taxAmount = Math.round(
        (subtotal - finalDiscountAmount) * (location.taxRate / 10000)
      );
      total = subtotal - finalDiscountAmount + taxAmount;
      vatableSales = subtotal - finalDiscountAmount;
    }

    // Generate order number: ORD-{locationSlug}-{timestamp}
    const orderNumber = `ORD-${location.slug.toUpperCase()}-${Date.now()}`;

    const now = Date.now();
    // Validate split payments add up to total
    if (args.paymentType === "split" && args.payments) {
      const splitTotal = args.payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(splitTotal - total) > 1) {
        throw new Error("Split payment amounts must equal the total");
      }
    }

    // Build payments array, applying tender info
    let finalPayments = args.payments;
    if (args.paymentType === "cash") {
      const tendered = args.cashTendered ?? total;
      if (tendered < total) {
        throw new Error("Tendered amount is less than total due");
      }
      finalPayments = [
        {
          type: "cash" as const,
          amount: total,
          tendered,
          change: tendered - total,
        },
      ];
    } else if (args.paymentType === "split" && args.payments) {
      finalPayments = args.payments.map((p) => {
        if (p.type === "cash" && p.tendered !== undefined) {
          if (p.tendered < p.amount) {
            throw new Error("Cash tendered is less than the cash portion");
          }
          return { ...p, change: p.tendered - p.amount };
        }
        return p;
      });
    }

    // BIR gap-less serial number. Two code paths:
    //   (1) Client offered a pre-allocated serial (offline mode). We
    //       validate and consume it from the device's reservation row.
    //       If the validation throws — expired block, range mismatch,
    //       already-used — we DON'T rethrow because that would dead-
    //       letter a payment that succeeded on the customer's side.
    //       Instead we fall through to fresh issuance and tag the order
    //       so the operator can reconcile on the BIR settings page.
    //   (2) Otherwise issue the next serial from the gap-less counter
    //       the same way online orders always have.
    let birSerial: string | null = null;
    if (args.clientBirSerial) {
      try {
        birSerial = await consumePreallocatedSerial(
          ctx,
          args.clientBirSerial.reservationId,
          args.clientBirSerial.serialNumber,
          args.clientBirSerial.deviceId
        );
      } catch (e) {
        await logAuditEntry(
          ctx,
          session.tenantId,
          session.userId,
          "bir.preallocated_serial_rejected",
          "orders",
          args.orderId,
          {
            reservationId: args.clientBirSerial.reservationId,
            serialNumber: args.clientBirSerial.serialNumber,
            reason: e instanceof Error ? e.message : String(e),
          }
        );
      }
    }
    if (!birSerial) {
      birSerial = await issueBirSerial(
        ctx,
        session.tenantId,
        order.locationId,
        `OR-${location.slug.toUpperCase()}-`
      );
    }

    await ctx.db.patch(args.orderId, {
      status: "completed",
      paymentType: args.paymentType,
      payments: finalPayments,
      orderNumber,
      birSerial: birSerial ?? undefined,
      subtotal,
      taxAmount,
      taxRate: location.taxRate,
      taxLabel: location.taxLabel,
      total,
      vatableSales,
      vatExemptSales,
      zeroRatedSales,
      ...(finalDiscountAmount > 0 ? { discountAmount: finalDiscountAmount } : {}),
      completedAt: now,
      updatedAt: now,
    });

    // Auto-deduct ingredient stock (Story 8.3)
    await deductStockForOrder(ctx, items, order.locationId, session.tenantId);

    // Customer engagement: update stats and add loyalty stamp (Story 11)
    if (order.customerId) {
      const customer = await ctx.db.get(order.customerId);
      if (customer && customer.tenantId === session.tenantId) {
        await ctx.db.patch(order.customerId, {
          visitCount: customer.visitCount + 1,
          totalSpent: customer.totalSpent + total,
          lastVisitAt: now,
          updatedAt: now,
        });
        await addStampInternal(ctx, order.customerId, session.tenantId);

        // Earn points
        await earnPointsInternal(
          ctx,
          session.tenantId,
          order.customerId,
          args.orderId,
          total,
          orderNumber,
        );
      }
    }

    // Increment subscription monthly order count (Story 14.2)
    const subscription = await ctx.db
      .query("tenantSubscriptions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", session.tenantId))
      .unique();
    if (subscription) {
      await ctx.db.patch(subscription._id, {
        monthlyOrderCount: subscription.monthlyOrderCount + 1,
        updatedAt: now,
      });
    }

    // Audit log
    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "order.completed",
      "orders",
      args.orderId,
      { orderNumber, paymentType: args.paymentType, total },
    );

    return { orderId: args.orderId, orderNumber, total };
  },
});

/**
 * One-shot offline-mode order submission. The client builds the entire
 * order locally while disconnected — items, modifiers, discount, payment,
 * customer linkage — and posts the whole bundle once the network is back.
 * In a single transaction we create the order, insert items + modifiers,
 * apply discount, finalise the BIR serial, run inventory deduction, and
 * record customer engagement. Mirrors the math in completeOrder above so
 * receipts printed offline match what gets written to the BIR record.
 *
 * Idempotency: clientOrderId is the natural key. If the same key was
 * already processed (replay-after-success), return the existing order
 * instead of inserting a duplicate. Indexed via `by_client_order_id`.
 */
export const submitOfflineOrder = mutation({
  args: {
    token: v.string(),
    clientOrderId: v.string(),
    locationId: v.id("locations"),
    tableId: v.optional(v.id("tables")),
    tableName: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    customerLabel: v.optional(v.string()),
    items: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        quantity: v.number(),
        modifiers: v.optional(
          v.array(
            v.object({
              modifierName: v.string(),
              priceAdjustment: v.number(),
            })
          )
        ),
        customerLabel: v.optional(v.string()),
      })
    ),
    discount: v.optional(
      v.object({
        type: v.union(v.literal("percentage"), v.literal("fixed")),
        value: v.number(),
        amount: v.optional(v.number()),
        reason: v.string(),
        srPwdType: v.optional(v.union(v.literal("senior"), v.literal("pwd"))),
        srPwdName: v.optional(v.string()),
        srPwdId: v.optional(v.string()),
      })
    ),
    paymentType: v.union(
      v.literal("cash"),
      v.literal("card"),
      v.literal("ewallet"),
      v.literal("split")
    ),
    payments: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet")),
          amount: v.number(),
          tendered: v.optional(v.number()),
          change: v.optional(v.number()),
        })
      )
    ),
    cashTendered: v.optional(v.number()),
    clientBirSerial: v.optional(
      v.object({
        reservationId: v.id("orderSerialReservations"),
        serialNumber: v.number(),
        deviceId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Idempotency: a prior replay may have already committed this order.
    // We index by clientOrderId so this lookup is one read.
    const existingByKey = await ctx.db
      .query("orders")
      .withIndex("by_client_order_id", (q) =>
        q.eq("clientOrderId", args.clientOrderId)
      )
      .first();
    if (existingByKey) {
      if (existingByKey.tenantId !== session.tenantId) {
        throw new Error("Client order id collision across tenants");
      }
      return {
        orderId: existingByKey._id,
        orderNumber: existingByKey.orderNumber ?? "",
        total: existingByKey.total,
        birSerial: existingByKey.birSerial ?? null,
        replayed: true,
      };
    }

    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }
    if (args.items.length === 0) {
      throw new Error("Cannot submit an order with no items");
    }

    const now = Date.now();

    // 1. Insert the order shell. We'll patch the totals once items are in.
    const orderId = await ctx.db.insert("orders", {
      tenantId: session.tenantId,
      locationId: args.locationId,
      userId: session.userId,
      status: "draft",
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      taxRate: location.taxRate,
      taxLabel: location.taxLabel,
      clientOrderId: args.clientOrderId,
      tableId: args.tableId,
      tableName: args.tableName,
      customerId: args.customerId,
      customerLabel: args.customerLabel,
      updatedAt: now,
    });

    // 2. Insert items + modifiers, snapshotting the price at order time
    //    (location override > menu base price). Mirrors addItemToOrder /
    //    addItemWithModifiers so the offline submission is indistinguishable
    //    from a normal flow once it lands.
    let subtotal = 0;
    for (const item of args.items) {
      const menuItem = await ctx.db.get(item.menuItemId);
      if (!menuItem || menuItem.tenantId !== session.tenantId) {
        throw new Error(`Menu item ${item.menuItemId} not found`);
      }
      const override = await ctx.db
        .query("locationPriceOverrides")
        .withIndex("by_menu_item_location", (q) =>
          q.eq("menuItemId", item.menuItemId).eq("locationId", args.locationId)
        )
        .unique();
      const effectivePrice = override?.price ?? menuItem.basePrice;
      const modifierTotal = (item.modifiers ?? []).reduce(
        (sum, m) => sum + m.priceAdjustment,
        0
      );
      const lineSubtotal = (effectivePrice + modifierTotal) * item.quantity;
      subtotal += lineSubtotal;

      const orderItemId = await ctx.db.insert("orderItems", {
        orderId,
        menuItemId: item.menuItemId,
        tenantId: session.tenantId,
        itemName: menuItem.name,
        basePrice: effectivePrice,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        customerLabel: item.customerLabel,
      });
      for (const mod of item.modifiers ?? []) {
        await ctx.db.insert("orderItemModifiers", {
          orderItemId,
          tenantId: session.tenantId,
          modifierName: mod.modifierName,
          priceAdjustment: mod.priceAdjustment,
        });
      }
    }

    // 3. Discount + VAT math. Mirrors completeOrder so the two paths
    //    can't drift — if regulation changes, we update both. The Sr/PWD
    //    branch strips VAT out of the gross and applies 20% to the net,
    //    same as RA 9994 / RA 10754 mandates.
    let finalDiscountAmount = args.discount?.amount ?? 0;
    if (
      args.discount?.type === "percentage" &&
      args.discount.value &&
      !args.discount.srPwdType
    ) {
      finalDiscountAmount = Math.round((subtotal * args.discount.value) / 100);
    }
    if (finalDiscountAmount > subtotal) finalDiscountAmount = subtotal;

    const isSrPwd = !!args.discount?.srPwdType;
    let taxAmount: number;
    let total: number;
    let vatableSales = 0;
    let vatExemptSales = 0;
    const zeroRatedSales = 0;

    if (isSrPwd) {
      const netOfVat = Math.round((subtotal * 100) / 112);
      const srPwdDiscount = Math.round(netOfVat * 0.2);
      finalDiscountAmount = srPwdDiscount;
      total = netOfVat - srPwdDiscount;
      taxAmount = 0;
      vatExemptSales = total;
    } else {
      taxAmount = Math.round(
        (subtotal - finalDiscountAmount) * (location.taxRate / 10000)
      );
      total = subtotal - finalDiscountAmount + taxAmount;
      vatableSales = subtotal - finalDiscountAmount;
    }

    // 4. Validate payment math matches the calculated total.
    let finalPayments = args.payments;
    if (args.paymentType === "cash") {
      const tendered = args.cashTendered ?? total;
      if (tendered < total) {
        throw new Error("Tendered amount is less than total due");
      }
      finalPayments = [
        {
          type: "cash" as const,
          amount: total,
          tendered,
          change: tendered - total,
        },
      ];
    } else if (args.paymentType === "split" && args.payments) {
      const splitTotal = args.payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(splitTotal - total) > 1) {
        throw new Error("Split payment amounts must equal the total");
      }
      finalPayments = args.payments.map((p) => {
        if (p.type === "cash" && p.tendered !== undefined) {
          if (p.tendered < p.amount) {
            throw new Error("Cash tendered is less than the cash portion");
          }
          return { ...p, change: p.tendered - p.amount };
        }
        return p;
      });
    }

    // 5. BIR serial. Same two-path logic as completeOrder: client-supplied
    //    pre-allocated serial preferred, falls back to fresh issuance.
    let birSerial: string | null = null;
    if (args.clientBirSerial) {
      try {
        birSerial = await consumePreallocatedSerial(
          ctx,
          args.clientBirSerial.reservationId,
          args.clientBirSerial.serialNumber,
          args.clientBirSerial.deviceId
        );
      } catch (e) {
        await logAuditEntry(
          ctx,
          session.tenantId,
          session.userId,
          "bir.preallocated_serial_rejected",
          "orders",
          orderId,
          {
            reservationId: args.clientBirSerial.reservationId,
            serialNumber: args.clientBirSerial.serialNumber,
            reason: e instanceof Error ? e.message : String(e),
          }
        );
      }
    }
    if (!birSerial) {
      birSerial = await issueBirSerial(
        ctx,
        session.tenantId,
        args.locationId,
        `OR-${location.slug.toUpperCase()}-`
      );
    }

    // 6. Finalise the order. Same shape completeOrder produces so all
    //    downstream consumers (reports, COGS, receipt template) see no
    //    difference between online and offline-replayed orders.
    const orderNumber = `ORD-${location.slug.toUpperCase()}-${Date.now()}`;
    await ctx.db.patch(orderId, {
      status: "completed",
      paymentType: args.paymentType,
      payments: finalPayments,
      orderNumber,
      birSerial: birSerial ?? undefined,
      subtotal,
      taxAmount,
      total,
      vatableSales,
      vatExemptSales,
      zeroRatedSales,
      discountType: args.discount?.type,
      discountValue: args.discount?.value,
      discountReason: args.discount?.reason,
      discountAmount: finalDiscountAmount > 0 ? finalDiscountAmount : undefined,
      srPwdType: args.discount?.srPwdType,
      srPwdName: args.discount?.srPwdName,
      srPwdId: args.discount?.srPwdId,
      completedAt: now,
      updatedAt: now,
    });

    // 7. Inventory + customer + subscription + audit — same tail as
    //    completeOrder. We refetch items so deductStockForOrder gets the
    //    real docs with their _ids.
    const persistedItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    await deductStockForOrder(
      ctx,
      persistedItems,
      args.locationId,
      session.tenantId
    );

    if (args.customerId) {
      const customer = await ctx.db.get(args.customerId);
      if (customer && customer.tenantId === session.tenantId) {
        await ctx.db.patch(args.customerId, {
          visitCount: customer.visitCount + 1,
          totalSpent: customer.totalSpent + total,
          lastVisitAt: now,
          updatedAt: now,
        });
        await addStampInternal(ctx, args.customerId, session.tenantId);
        await earnPointsInternal(
          ctx,
          session.tenantId,
          args.customerId,
          orderId,
          total,
          orderNumber
        );
      }
    }

    const subscription = await ctx.db
      .query("tenantSubscriptions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", session.tenantId))
      .unique();
    if (subscription) {
      await ctx.db.patch(subscription._id, {
        monthlyOrderCount: subscription.monthlyOrderCount + 1,
        updatedAt: now,
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "order.completed_offline",
      "orders",
      orderId,
      {
        orderNumber,
        clientOrderId: args.clientOrderId,
        paymentType: args.paymentType,
        total,
      }
    );

    return {
      orderId,
      orderNumber,
      total,
      birSerial: birSerial ?? null,
      replayed: false,
    };
  },
});

export const assignTableToOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    tableId: v.optional(v.id("tables")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only assign table to draft orders");
    }

    let tableName: string | undefined;
    if (args.tableId) {
      const table = await ctx.db.get(args.tableId);
      if (!table || table.tenantId !== session.tenantId) {
        throw new Error("Table not found");
      }
      tableName = table.name;
    }

    await ctx.db.patch(args.orderId, {
      tableId: args.tableId,
      tableName,
      updatedAt: Date.now(),
    });

    return args.orderId;
  },
});

export const linkCustomerToOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only link customer to draft orders");
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    await ctx.db.patch(args.orderId, {
      customerId: args.customerId,
      updatedAt: Date.now(),
    });

    return args.orderId;
  },
});

export const unlinkCustomerFromOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only unlink customer from draft orders");
    }

    await ctx.db.patch(args.orderId, {
      customerId: undefined,
      updatedAt: Date.now(),
    });

    return args.orderId;
  },
});

export const applyDiscount = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountValue: v.number(),
    discountReason: v.string(),
    /** When the discount comes from a configured preset, the client passes
     *  its id so the server uses that preset's `requiresAuth` flag as the
     *  source of truth for whether a barista can apply it. Custom (free-
     *  form) discounts still fall back to the per-role size cap below. */
    presetId: v.optional(v.id("discountPresets")),
    /** Senior Citizen / PWD capture — required by BIR. When `srPwdType`
     *  is provided, the order is treated as VAT-exempt at completion
     *  (regardless of the discount value passed). */
    srPwdType: v.optional(v.union(v.literal("senior"), v.literal("pwd"))),
    srPwdName: v.optional(v.string()),
    srPwdId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only apply discounts to draft orders");
    }

    if (args.discountValue <= 0) {
      throw new Error("Discount value must be positive");
    }

    // Calculate discount amount
    let discountAmount: number;
    if (args.discountType === "percentage") {
      if (args.discountValue > 100) {
        throw new Error("Percentage discount cannot exceed 100%");
      }
      discountAmount = Math.round(order.subtotal * args.discountValue / 100);
    } else {
      discountAmount = args.discountValue; // already in cents
    }

    // Cap: discount cannot exceed subtotal
    if (discountAmount > order.subtotal) {
      discountAmount = order.subtotal;
    }

    // Authorization:
    //   - If a preset was used, honour its `requiresAuth` flag verbatim.
    //     Owner/manager always pass; a barista is blocked when the preset
    //     explicitly requires manager auth (regardless of size).
    //   - If no preset (custom discount), fall back to the per-role size
    //     cap so a barista can't hand out a 100% discount free-form.
    if (session.role === "barista") {
      if (args.presetId) {
        const preset = await ctx.db.get(args.presetId);
        if (!preset || preset.tenantId !== session.tenantId) {
          throw new Error("Discount preset not found");
        }
        if (preset.requiresAuth) {
          throw new Error("Manager authorization required for this discount");
        }
        // Preset is barista-approved → no extra size cap; admin already
        // signed off on its value when they configured it.
      } else {
        const discountPercent = order.subtotal > 0
          ? (discountAmount / order.subtotal) * 100
          : 0;
        if (discountPercent > 20 || discountAmount > 20000) {
          throw new Error(
            "Custom discount exceeds barista limit (20% or ₱200). Use a preset or get manager authorization."
          );
        }
      }
    }

    // Recalculate total
    const total = order.subtotal - discountAmount + order.taxAmount;

    // For Senior/PWD, require name + ID — BIR rules. The final 20%
    // off + VAT-exempt math is applied in completeOrder, not here, so
    // the on-screen total stays consistent until checkout.
    if (args.srPwdType) {
      if (!args.srPwdName?.trim() || !args.srPwdId?.trim()) {
        throw new Error(
          "Senior Citizen / PWD discount requires the cardholder's name and OSCA/PWD ID"
        );
      }
    }

    await ctx.db.patch(args.orderId, {
      discountType: args.discountType,
      discountValue: args.discountValue,
      discountAmount,
      discountReason: args.discountReason,
      discountApprovedBy: session.role !== "barista" ? session.userId : undefined,
      srPwdType: args.srPwdType,
      srPwdName: args.srPwdName?.trim() || undefined,
      srPwdId: args.srPwdId?.trim() || undefined,
      total,
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "order.discount_applied",
      "orders",
      args.orderId,
      {
        discountType: args.discountType,
        discountValue: args.discountValue,
        discountAmount,
        discountReason: args.discountReason,
      },
    );

    return args.orderId;
  },
});

export const removeDiscount = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "draft") {
      throw new Error("Can only remove discounts from draft orders");
    }

    // Recalculate total without discount
    const total = order.subtotal + order.taxAmount;

    await ctx.db.patch(args.orderId, {
      discountType: undefined,
      discountValue: undefined,
      discountAmount: undefined,
      discountReason: undefined,
      discountApprovedBy: undefined,
      total,
      updatedAt: Date.now(),
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "order.discount_removed",
      "orders",
      args.orderId,
      {},
    );

    return args.orderId;
  },
});

export const refundOrder = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    refundAmount: v.number(),
    refundReason: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== session.tenantId) {
      throw new Error("Order not found");
    }
    if (order.status !== "completed") {
      throw new Error("Can only refund completed orders");
    }
    if (order.refundedAt) {
      throw new Error("Order has already been refunded");
    }
    if (args.refundAmount <= 0) {
      throw new Error("Refund amount must be greater than zero");
    }
    if (args.refundAmount > order.total) {
      throw new Error("Refund amount cannot exceed order total");
    }

    const now = Date.now();

    await ctx.db.patch(args.orderId, {
      refundedAt: now,
      refundedBy: session.userId,
      refundReason: args.refundReason,
      refundAmount: args.refundAmount,
      updatedAt: now,
    });

    // If customer was linked, deduct points earned from this order
    if (order.customerId) {
      const customer = await ctx.db.get(order.customerId);
      if (customer && customer.tenantId === session.tenantId) {
        // Find the points ledger entry for this order
        const ledgerEntries = await ctx.db
          .query("pointsLedger")
          .withIndex("by_customer", (q: any) => q.eq("customerId", order.customerId))
          .collect();

        const orderEntry = ledgerEntries.find(
          (e) => e.orderId === args.orderId && e.type === "earned"
        );

        if (orderEntry && orderEntry.points > 0) {
          const currentBalance = customer.pointsBalance ?? 0;
          const deduction = Math.min(orderEntry.points, currentBalance);

          if (deduction > 0) {
            await ctx.db.patch(order.customerId!, {
              pointsBalance: currentBalance - deduction,
            });

            await ctx.db.insert("pointsLedger", {
              customerId: order.customerId!,
              tenantId: session.tenantId,
              type: "adjusted",
              points: -deduction,
              description: `Refund: Order #${order.orderNumber ?? args.orderId}`,
              orderId: args.orderId,
              createdAt: now,
            });
          }
        }
      }
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "order.refunded",
      "orders",
      args.orderId,
      {
        orderNumber: order.orderNumber,
        refundAmount: args.refundAmount,
        refundReason: args.refundReason,
        isFullRefund: args.refundAmount === order.total,
      },
    );

    return { success: true, refundAmount: args.refundAmount };
  },
});

// Internal helper — not exported as a Convex function
async function recalculateOrderTotals(ctx: MutationCtx, orderId: Id<"orders">) {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  const order = await ctx.db.get(orderId);
  if (!order) return;

  const taxAmount = Math.round(subtotal * (order.taxRate / 10000)); // taxRate in basis points
  const discountAmount = order.discountAmount ?? 0;
  // Recalculate discount if percentage-based (subtotal may have changed)
  let effectiveDiscount = discountAmount;
  if (order.discountType === "percentage" && order.discountValue) {
    effectiveDiscount = Math.round(subtotal * order.discountValue / 100);
  }
  // Cap discount at subtotal
  if (effectiveDiscount > subtotal) {
    effectiveDiscount = subtotal;
  }
  const total = subtotal - effectiveDiscount + taxAmount;

  await ctx.db.patch(order._id, {
    subtotal,
    taxAmount,
    total,
    ...(order.discountType ? { discountAmount: effectiveDiscount } : {}),
    updatedAt: Date.now(),
  });
}

/**
 * Deduct ingredient stock for all items in a completed order.
 * For each order item, looks up recipes to find which ingredients are consumed,
 * then decrements ingredientStock accordingly. If no stock record exists,
 * creates one with negative quantity (corrected on next stock take).
 */
async function deductStockForOrder(
  ctx: MutationCtx,
  orderItems: Doc<"orderItems">[],
  locationId: Id<"locations">,
  tenantId: Id<"tenants">,
) {
  for (const item of orderItems) {
    // Look up which modifiers this order line carries — used for both
    // variant matching (recipe rows keyed by name) and modifier-specific
    // ingredient deltas (rows in the modifierRecipes table).
    const chosenModifiers = await ctx.db
      .query("orderItemModifiers")
      .withIndex("by_order_item", (q: any) => q.eq("orderItemId", item._id))
      .collect();
    const chosenModifierNames = new Set<string>(
      chosenModifiers.map((m) => m.modifierName)
    );

    // 1. Pick base or variant recipe rows.
    //    Per-INGREDIENT preference: if there's a variant-keyed row whose
    //    key matches a chosen modifier (e.g. "500ml"), use that row for
    //    THAT ingredient; for every other ingredient, fall back to its
    //    base (no-variantKey) row. The old "all-or-nothing" filter
    //    dropped ingredients like Pop Can / Cup that only had base rows
    //    whenever ANY other ingredient had a 500ml variant.
    const allRecipes = await ctx.db
      .query("recipes")
      .withIndex("by_menu_item", (q: any) => q.eq("menuItemId", item.menuItemId))
      .collect();

    const variantKeyed = allRecipes.filter(
      (r) => r.variantKey && chosenModifierNames.has(r.variantKey)
    );
    const baseRows = allRecipes.filter((r) => r.variantKey === undefined);
    const ingredientsCoveredByVariant = new Set(
      variantKeyed.map((r) => String(r.ingredientId))
    );
    const recipesToConsume = [
      ...variantKeyed,
      ...baseRows.filter(
        (r) => !ingredientsCoveredByVariant.has(String(r.ingredientId))
      ),
    ];

    // Build the per-line ingredient totals before applying modifier deltas.
    const totals = new Map<string, number>();
    for (const r of recipesToConsume) {
      const key = String(r.ingredientId);
      totals.set(key, (totals.get(key) ?? 0) + r.quantityUsed * item.quantity);
    }
    // Snapshot of which ingredient IDs are present in the BASE recipe — used
    // by `onlyIfBaseHas` rows so a size modifier's per-syrup boost only fires
    // for drinks that actually contain that syrup.
    const baseIngredientIds = new Set<string>(totals.keys());

    // 2. Apply modifier deltas. For each chosen modifier we look up the
    //    actual modifier doc (by name within the tenant) and pull its
    //    ingredient rows. `replacesIngredientId` removes a base entry; the
    //    new ingredient is then added at quantityUsed × line.quantity.
    if (chosenModifiers.length > 0) {
      const tenantModifiers = await ctx.db
        .query("modifiers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
        .collect();
      const modifierByName = new Map<string, Doc<"modifiers">>();
      for (const m of tenantModifiers) modifierByName.set(m.name, m);

      for (const om of chosenModifiers) {
        const mod = modifierByName.get(om.modifierName);
        if (!mod) continue;
        const allModRows = await ctx.db
          .query("modifierRecipes")
          .withIndex("by_modifier", (q: any) => q.eq("modifierId", mod._id))
          .collect();

        // Pick the right rows — per-INGREDIENT preference (same logic as
        // base recipes above). A variant row wins for its own ingredient;
        // ingredients with only default rows still apply. This fixes the
        // case where e.g. "Oat Milk has a 500ml row but Cup doesn't" —
        // previously the Cup row was silently skipped.
        const matchingByIng = new Map<string, typeof allModRows[number]>();
        for (const r of allModRows) {
          if (r.variantKey && chosenModifierNames.has(r.variantKey)) {
            matchingByIng.set(String(r.ingredientId), r);
          }
        }
        const rowsToApply = [
          ...matchingByIng.values(),
          ...allModRows.filter(
            (r) =>
              r.variantKey === undefined &&
              !matchingByIng.has(String(r.ingredientId))
          ),
        ];

        for (const row of rowsToApply) {
          // Conditional rows (size-driven boosts) only apply when the base
          // recipe already contains the relevant ingredient. For pure swap
          // rows we look at the replaced ingredient; otherwise the row's own
          // ingredient. Prevents "500ml adds Hazelnut Syrup to a Vanilla
          // Latte" type wrong deductions.
          if (row.onlyIfBaseHas) {
            const checkKey = row.replacesIngredientId
              ? String(row.replacesIngredientId)
              : String(row.ingredientId);
            if (!baseIngredientIds.has(checkKey)) continue;
          }
          if (row.replacesIngredientId) {
            totals.delete(String(row.replacesIngredientId));
          }
          const key = String(row.ingredientId);
          totals.set(
            key,
            (totals.get(key) ?? 0) + row.quantityUsed * item.quantity
          );
        }
      }
    }

    // 3. Apply totals to ingredient stock at this location.
    for (const [ingredientIdStr, deductionAmount] of totals) {
      if (deductionAmount === 0) continue;
      const ingredientId = ingredientIdStr as Id<"ingredients">;

      const stockRecord = await ctx.db
        .query("ingredientStock")
        .withIndex("by_ingredient_location", (q: any) =>
          q.eq("ingredientId", ingredientId).eq("locationId", locationId)
        )
        .unique();

      if (stockRecord) {
        await ctx.db.patch(stockRecord._id, {
          quantity: stockRecord.quantity - deductionAmount,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("ingredientStock", {
          ingredientId,
          locationId,
          tenantId,
          quantity: -deductionAmount,
          updatedAt: Date.now(),
        });
      }
    }
  }
}
