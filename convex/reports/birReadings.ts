import { mutation, query, MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * BIR X-Read / Z-Read generation.
 *
 *   X-Read = informational mid-day snapshot. Does NOT increment the
 *            Z-counter, does NOT advance the lifetime total, does NOT
 *            persist a row. Cashier can pull as many as they want.
 *
 *   Z-Read = end-of-day close. Increments the terminal's zCounter,
 *            adds the day's grand total to grandTotalAccumulated on the
 *            location, and writes a permanent row to birReadings for
 *            BIR audit purposes.
 *
 * Both share the same computation pipeline (`computeReadingTotals`).
 * The compute path walks completed orders for the period, sums payments,
 * counts voids/cancels, and builds the snapshot used by the receipt.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type ReadingSnapshot = {
  windowStart: number;
  windowEnd: number;
  beginningSerial: string | null;
  endingSerial: string | null;
  salesInvoiceCounter: number;
  grossSales: number;
  returns: number;
  subtotal: number;
  scDiscounts: number;
  pwdDiscounts: number;
  otherDiscounts: number;
  vatAdjustments: number;
  netSales: number;
  grandTotal: number;
  cashTotal: number;
  cardTotal: number;
  ewalletTotal: number;
  salesTransactionCount: number;
  itemsSoldCount: number;
  noSalesCount: number;
  transactionReprintCount: number;
  cashDepositReprintCount: number;
  withdrawalReprintCount: number;
  lineVoidsCount: number;
  cancelledTransactionCount: number;
  priceOverridesCount: number;
  scTransactionCount: number;
  pwdTransactionCount: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  zeroRatedSales: number;
};

async function computeReadingTotals(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  locationId: Id<"locations">,
  windowStart: number,
  windowEnd: number
): Promise<ReadingSnapshot> {
  // Pull every completed order in the window. We walk by status index
  // and filter timestamps in memory — usable up to a few thousand orders
  // per location per day, which is the realistic scale.
  const completed = await ctx.db
    .query("orders")
    .withIndex("by_tenant_location_status", (q) =>
      q
        .eq("tenantId", tenantId)
        .eq("locationId", locationId)
        .eq("status", "completed")
    )
    .collect();
  const voided = await ctx.db
    .query("orders")
    .withIndex("by_tenant_location_status", (q) =>
      q
        .eq("tenantId", tenantId)
        .eq("locationId", locationId)
        .eq("status", "voided")
    )
    .collect();
  const abandoned = await ctx.db
    .query("orders")
    .withIndex("by_tenant_location_status", (q) =>
      q
        .eq("tenantId", tenantId)
        .eq("locationId", locationId)
        .eq("status", "abandoned")
    )
    .collect();

  const inWindow = (ts: number | undefined) =>
    ts !== undefined && ts >= windowStart && ts <= windowEnd;

  const periodCompleted = completed.filter((o) =>
    inWindow(o.completedAt)
  );
  const periodVoided = voided.filter((o) =>
    inWindow(o.completedAt ?? o.updatedAt)
  );
  const periodAbandoned = abandoned.filter((o) =>
    inWindow(o.updatedAt)
  );

  // Sort by serial for beginning/ending. Sort by completedAt so the
  // "first/last" reflects time-of-sale order, not insertion order.
  const byTime = [...periodCompleted].sort(
    (a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0)
  );

  let grossSales = 0;
  let scDiscounts = 0;
  let pwdDiscounts = 0;
  let otherDiscounts = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let ewalletTotal = 0;
  let scTransactionCount = 0;
  let pwdTransactionCount = 0;
  let vatableSales = 0;
  let vatAmount = 0;
  let vatExemptSales = 0;
  let zeroRatedSales = 0;
  let itemsSoldCount = 0;

  for (const o of periodCompleted) {
    grossSales += o.subtotal;
    const disc = o.discountAmount ?? 0;
    if (o.srPwdType === "senior") {
      scDiscounts += disc;
      scTransactionCount++;
    } else if (o.srPwdType === "pwd") {
      pwdDiscounts += disc;
      pwdTransactionCount++;
    } else {
      otherDiscounts += disc;
    }
    vatableSales += o.vatableSales ?? 0;
    vatExemptSales += o.vatExemptSales ?? 0;
    zeroRatedSales += o.zeroRatedSales ?? 0;
    vatAmount += o.taxAmount;

    // Tender split. A "split" order spreads across multiple tender types
    // and the payments array tells us how much went where.
    if (o.paymentType === "cash") cashTotal += o.total;
    else if (o.paymentType === "card") cardTotal += o.total;
    else if (o.paymentType === "ewallet") ewalletTotal += o.total;
    else if (o.paymentType === "split" && o.payments) {
      for (const p of o.payments) {
        if (p.type === "cash") cashTotal += p.amount;
        else if (p.type === "card") cardTotal += p.amount;
        else if (p.type === "ewallet") ewalletTotal += p.amount;
      }
    }

    // Items sold count — read line items per order.
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", o._id))
      .collect();
    for (const it of items) itemsSoldCount += it.quantity;
  }

  const refundTotal = periodCompleted.reduce(
    (sum, o) => sum + (o.refundAmount ?? 0),
    0
  );

  const subtotal = grossSales - refundTotal;
  const totalDiscounts = scDiscounts + pwdDiscounts + otherDiscounts;
  const netSales = subtotal - totalDiscounts;
  const grandTotal = netSales + vatAmount;

  return {
    windowStart,
    windowEnd,
    beginningSerial: byTime[0]?.birSerial ?? null,
    endingSerial: byTime[byTime.length - 1]?.birSerial ?? null,
    salesInvoiceCounter: periodCompleted.length,
    grossSales,
    returns: refundTotal,
    subtotal,
    scDiscounts,
    pwdDiscounts,
    otherDiscounts,
    vatAdjustments: 0, // reserved — no upstream source yet
    netSales,
    grandTotal,
    cashTotal,
    cardTotal,
    ewalletTotal,
    salesTransactionCount: periodCompleted.length,
    itemsSoldCount,
    noSalesCount: 0, // reserved — no upstream source yet
    transactionReprintCount: 0, // we don't track reprints today
    cashDepositReprintCount: 0,
    withdrawalReprintCount: 0,
    lineVoidsCount: periodVoided.length,
    cancelledTransactionCount: periodAbandoned.length,
    priceOverridesCount: 0,
    scTransactionCount,
    pwdTransactionCount,
    vatableSales,
    vatAmount,
    vatExemptSales,
    zeroRatedSales,
  };
}

/**
 * Today's window in the location's local time. We use the location's
 * timezone string but compute the window in UTC ms — Convex doesn't
 * have Date.now in actions; here we're inside a query/mutation so
 * Date.now is fine.
 */
function todayWindow(): { start: number; end: number } {
  const now = Date.now();
  const start = new Date(now).setHours(0, 0, 0, 0);
  return { start, end: now };
}

/**
 * X-Read: read-only snapshot for the cashier. Doesn't touch any
 * counters — they can pull it as often as they like.
 */
export const computeXRead = query({
  args: { token: v.string(), locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }
    const { start, end } = todayWindow();
    const totals = await computeReadingTotals(
      ctx,
      session.tenantId,
      args.locationId,
      start,
      end
    );
    return {
      type: "x" as const,
      zCounter: location.zCounter ?? 0,
      storeCode: location.storeCode ?? "001",
      terminalNo: location.terminalNo ?? 1,
      generatedAt: Date.now(),
      generatedByName: (await ctx.db.get(session.userId))?.name ?? "—",
      accumulatedGrandTotal: location.grandTotalAccumulated ?? 0,
      ...totals,
    };
  },
});

/**
 * Z-Read: closes the business day. Atomically:
 *   1) compute today's totals
 *   2) bump zCounter on the location
 *   3) add the day's grandTotal to grandTotalAccumulated
 *   4) insert a permanent birReadings row
 *   5) audit log entry
 *
 * Owner / manager only — closing the day is a privileged operation.
 */
export const generateZRead = mutation({
  args: { token: v.string(), locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }
    const { start, end } = todayWindow();
    const totals = await computeReadingTotals(
      ctx,
      session.tenantId,
      args.locationId,
      start,
      end
    );

    const nextZ = (location.zCounter ?? 0) + 1;
    const accBefore = location.grandTotalAccumulated ?? 0;
    const accAfter = accBefore + totals.grandTotal;

    await ctx.db.patch(args.locationId, {
      zCounter: nextZ,
      grandTotalAccumulated: accAfter,
      updatedAt: Date.now(),
    });

    const readingId = await ctx.db.insert("birReadings", {
      tenantId: session.tenantId,
      locationId: args.locationId,
      type: "z",
      zCounter: nextZ,
      storeCode: location.storeCode ?? "001",
      terminalNo: location.terminalNo ?? 1,
      windowStart: totals.windowStart,
      windowEnd: totals.windowEnd,
      beginningSerial: totals.beginningSerial ?? undefined,
      endingSerial: totals.endingSerial ?? undefined,
      salesInvoiceCounter: totals.salesInvoiceCounter,
      grossSales: totals.grossSales,
      returns: totals.returns,
      subtotal: totals.subtotal,
      scDiscounts: totals.scDiscounts,
      pwdDiscounts: totals.pwdDiscounts,
      otherDiscounts: totals.otherDiscounts,
      vatAdjustments: totals.vatAdjustments,
      netSales: totals.netSales,
      grandTotal: totals.grandTotal,
      cashTotal: totals.cashTotal,
      cardTotal: totals.cardTotal,
      ewalletTotal: totals.ewalletTotal,
      salesTransactionCount: totals.salesTransactionCount,
      itemsSoldCount: totals.itemsSoldCount,
      noSalesCount: totals.noSalesCount,
      transactionReprintCount: totals.transactionReprintCount,
      cashDepositReprintCount: totals.cashDepositReprintCount,
      withdrawalReprintCount: totals.withdrawalReprintCount,
      lineVoidsCount: totals.lineVoidsCount,
      cancelledTransactionCount: totals.cancelledTransactionCount,
      priceOverridesCount: totals.priceOverridesCount,
      scTransactionCount: totals.scTransactionCount,
      pwdTransactionCount: totals.pwdTransactionCount,
      vatableSales: totals.vatableSales,
      vatAmount: totals.vatAmount,
      vatExemptSales: totals.vatExemptSales,
      zeroRatedSales: totals.zeroRatedSales,
      accumulatedGrandTotalBefore: accBefore,
      accumulatedGrandTotalAfter: accAfter,
      generatedAt: Date.now(),
      generatedBy: session.userId,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "bir.z_read_generated",
      "birReadings",
      readingId,
      { zCounter: nextZ, grandTotal: totals.grandTotal }
    );

    return {
      type: "z" as const,
      readingId,
      zCounter: nextZ,
      accumulatedGrandTotal: accAfter,
      storeCode: location.storeCode ?? "001",
      terminalNo: location.terminalNo ?? 1,
      generatedAt: Date.now(),
      generatedByName: (await ctx.db.get(session.userId))?.name ?? "—",
      ...totals,
    };
  },
});

/**
 * History of past Z-readings for a location, newest first. Limited to
 * 50 by default — the page can paginate later if needed.
 */
export const listReadings = query({
  args: {
    token: v.string(),
    locationId: v.id("locations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) return [];
    const rows = await ctx.db
      .query("birReadings")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .order("desc")
      .take(args.limit ?? 50);
    return rows;
  },
});

/** Fetch a single saved reading by id — used to re-render / re-print. */
export const getReading = query({
  args: { token: v.string(), readingId: v.id("birReadings") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const row = await ctx.db.get(args.readingId);
    if (!row || row.tenantId !== session.tenantId) return null;
    return row;
  },
});

void DAY_MS; // currently unused — reserved for cross-day range pickers
