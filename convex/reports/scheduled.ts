import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

export type ReportSnapshot = {
  tenantName: string;
  tenantTimezone: string;
  currency: string;
  rangeLabel: string;
  startMs: number;
  endMs: number;
  totals: {
    grossSales: number;
    netSales: number;
    taxCollected: number;
    discountTotal: number;
    refundTotal: number;
    orderCount: number;
    avgOrderValue: number;
  };
  paymentBreakdown: Array<{ type: string; amount: number; count: number }>;
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
  voids: { count: number; total: number };
  shifts: Array<{
    locationName: string;
    userName: string;
    startedAt: number;
    endedAt: number | null;
    openingCash: number;
    closingCash: number | null;
    expectedCash: number | null;
    variance: number | null;
    status: "active" | "closed";
  }>;
  staffOnDuty: Array<{
    userName: string;
    locationName: string;
    clockInAt: number;
    minutesSoFar: number;
  }>;
  staffHours: Array<{
    userName: string;
    workMinutes: number;
    overtimeMinutes: number;
    earnedAmount: number;
  }>;
  lowStock: Array<{
    name: string;
    locationName: string;
    quantity: number;
    threshold: number;
    unit: string;
  }>;
};

export const buildSnapshot = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    startMs: v.number(),
    endMs: v.number(),
    rangeLabel: v.string(),
  },
  handler: async (ctx, args): Promise<ReportSnapshot> => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");

    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const completedInRange = allOrders.filter((o) => {
      if (o.status !== "completed") return false;
      const t = o.completedAt ?? o.updatedAt;
      return t >= args.startMs && t <= args.endMs;
    });
    const voidedInRange = allOrders.filter((o) => {
      if (o.status !== "voided") return false;
      const t = o.completedAt ?? o.updatedAt;
      return t >= args.startMs && t <= args.endMs;
    });

    let grossSales = 0;
    let taxCollected = 0;
    let discountTotal = 0;
    let refundTotal = 0;
    const paymentMap = new Map<string, { amount: number; count: number }>();

    for (const o of completedInRange) {
      grossSales += o.total;
      taxCollected += o.taxAmount;
      discountTotal += o.discountAmount ?? 0;
      refundTotal += o.refundAmount ?? 0;
      if (o.paymentType === "split" && o.payments) {
        for (const p of o.payments) {
          const cur = paymentMap.get(p.type) ?? { amount: 0, count: 0 };
          paymentMap.set(p.type, {
            amount: cur.amount + p.amount,
            count: cur.count + 1,
          });
        }
      } else if (o.paymentType) {
        const cur = paymentMap.get(o.paymentType) ?? { amount: 0, count: 0 };
        paymentMap.set(o.paymentType, {
          amount: cur.amount + o.total,
          count: cur.count + 1,
        });
      }
    }
    const netSales = grossSales - refundTotal;

    const itemMap = new Map<string, { quantity: number; revenue: number }>();
    for (const o of completedInRange) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", o._id))
        .collect();
      for (const it of items) {
        const cur = itemMap.get(it.itemName) ?? { quantity: 0, revenue: 0 };
        itemMap.set(it.itemName, {
          quantity: cur.quantity + it.quantity,
          revenue: cur.revenue + it.subtotal,
        });
      }
    }
    const topItems = Array.from(itemMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const locationName = (id: Id<"locations">) =>
      locations.find((l) => l._id === id)?.name ?? "Unknown";

    const allShifts = await ctx.db
      .query("shifts")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const shiftsInRange = allShifts.filter((s) => {
      const t = s.endedAt ?? s.startedAt;
      return t >= args.startMs && t <= args.endMs;
    });
    const userIds = new Set<Id<"users">>();
    for (const s of shiftsInRange) userIds.add(s.userId);

    const onDutySheets = await ctx.db
      .query("timesheets")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", args.tenantId).eq("status", "active")
      )
      .collect();
    const onBreakSheets = await ctx.db
      .query("timesheets")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", args.tenantId).eq("status", "on_break")
      )
      .collect();
    for (const ts of [...onDutySheets, ...onBreakSheets]) userIds.add(ts.userId);

    const completedSheets = await ctx.db
      .query("timesheets")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const sheetsInRange = completedSheets.filter((t) => {
      if (t.status !== "completed" && t.status !== "auto_closed") return false;
      const ts = t.clockOutAt ?? t.clockInAt;
      return ts >= args.startMs && ts <= args.endMs;
    });
    for (const t of sheetsInRange) userIds.add(t.userId);

    const userNameMap = new Map<string, string>();
    for (const id of userIds) {
      const u = await ctx.db.get(id);
      if (u) userNameMap.set(String(id), u.name);
    }

    const shifts = shiftsInRange.map((s) => ({
      locationName: locationName(s.locationId),
      userName: userNameMap.get(String(s.userId)) ?? "Unknown",
      startedAt: s.startedAt,
      endedAt: s.endedAt ?? null,
      openingCash: s.openingCash,
      closingCash: s.closingCash ?? null,
      expectedCash: s.expectedCash ?? null,
      variance:
        s.closingCash !== undefined && s.expectedCash !== undefined
          ? s.closingCash - s.expectedCash
          : null,
      status: (s.status === "active" ? "active" : "closed") as "active" | "closed",
    }));

    const staffOnDuty = [...onDutySheets, ...onBreakSheets].map((ts) => ({
      userName: userNameMap.get(String(ts.userId)) ?? "Unknown",
      locationName: locationName(ts.locationId),
      clockInAt: ts.clockInAt,
      minutesSoFar: Math.max(0, Math.floor((Date.now() - ts.clockInAt) / 60000)),
    }));

    const staffHoursMap = new Map<
      string,
      { workMinutes: number; overtimeMinutes: number; earnedAmount: number }
    >();
    for (const t of sheetsInRange) {
      const k = String(t.userId);
      const cur = staffHoursMap.get(k) ?? {
        workMinutes: 0,
        overtimeMinutes: 0,
        earnedAmount: 0,
      };
      staffHoursMap.set(k, {
        workMinutes: cur.workMinutes + (t.workMinutes ?? 0),
        overtimeMinutes: cur.overtimeMinutes + (t.overtimeMinutes ?? 0),
        earnedAmount: cur.earnedAmount + (t.earnedAmount ?? 0),
      });
    }
    const staffHours = Array.from(staffHoursMap.entries())
      .map(([uid, v]) => ({
        userName: userNameMap.get(uid) ?? "Unknown",
        ...v,
      }))
      .sort((a, b) => b.workMinutes - a.workMinutes);

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", args.tenantId).eq("status", "active")
      )
      .collect();
    const stocks = await ctx.db
      .query("ingredientStock")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const lowStock: ReportSnapshot["lowStock"] = [];
    for (const ing of ingredients) {
      const matching = stocks.filter((s) => s.ingredientId === ing._id);
      if (matching.length === 0) {
        if (ing.reorderThreshold > 0) {
          lowStock.push({
            name: ing.name,
            locationName: "—",
            quantity: 0,
            threshold: ing.reorderThreshold,
            unit: ing.unit,
          });
        }
        continue;
      }
      for (const st of matching) {
        if (st.quantity < ing.reorderThreshold) {
          lowStock.push({
            name: ing.name,
            locationName: locationName(st.locationId),
            quantity: st.quantity,
            threshold: ing.reorderThreshold,
            unit: ing.unit,
          });
        }
      }
    }

    return {
      tenantName: tenant.name,
      tenantTimezone: tenant.timezone,
      currency: tenant.currency,
      rangeLabel: args.rangeLabel,
      startMs: args.startMs,
      endMs: args.endMs,
      totals: {
        grossSales,
        netSales,
        taxCollected,
        discountTotal,
        refundTotal,
        orderCount: completedInRange.length,
        avgOrderValue:
          completedInRange.length > 0
            ? Math.round(grossSales / completedInRange.length)
            : 0,
      },
      paymentBreakdown: Array.from(paymentMap.entries())
        .map(([type, v]) => ({ type, ...v }))
        .sort((a, b) => b.amount - a.amount),
      topItems,
      voids: {
        count: voidedInRange.length,
        total: voidedInRange.reduce((s, o) => s + o.total, 0),
      },
      shifts,
      staffOnDuty,
      staffHours,
      lowStock,
    };
  },
});

export const listTenantsForReports = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tenants = await ctx.db
      .query("tenants")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const out: Array<{
      tenantId: Id<"tenants">;
      tenantName: string;
      timezone: string;
      reportEmail?: string;
      reportFrequency?: "daily" | "weekly" | "monthly" | "none";
      sendPartialReport: boolean;
      partialReportTime: string;
      dailyReportTime: string;
      lastPartialReportAt?: number;
      lastDailyReportAt?: number;
    }> = [];
    for (const t of tenants) {
      const settings: Doc<"tenantSettings"> | null = await ctx.db
        .query("tenantSettings")
        .withIndex("by_tenant", (q) => q.eq("tenantId", t._id))
        .unique();
      out.push({
        tenantId: t._id,
        tenantName: t.name,
        timezone: t.timezone,
        reportEmail: settings?.reportEmail,
        reportFrequency: settings?.reportFrequency,
        sendPartialReport: settings?.sendPartialReport ?? false,
        partialReportTime: settings?.partialReportTime ?? "14:00",
        dailyReportTime: settings?.dailyReportTime ?? "22:00",
        lastPartialReportAt: settings?.lastPartialReportAt,
        lastDailyReportAt: settings?.lastDailyReportAt,
      });
    }
    return out;
  },
});

export const markReportSent = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    kind: v.union(v.literal("partial"), v.literal("daily")),
    sentAt: v.number(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("tenantSettings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();
    if (!settings) return;
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.kind === "partial") update.lastPartialReportAt = args.sentAt;
    else update.lastDailyReportAt = args.sentAt;
    await ctx.db.patch(settings._id, update);
  },
});
