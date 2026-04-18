import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { Doc, Id } from "../_generated/dataModel";

export const listPeriods = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const periods = await ctx.db
      .query("payPeriods")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const sorted = periods.sort((a, b) => b.startDate - a.startDate);

    const results = [];
    for (const p of sorted) {
      const payslips = await ctx.db
        .query("payslips")
        .withIndex("by_period", (q) => q.eq("payPeriodId", p._id))
        .collect();
      const totalGross = payslips.reduce((s, ps) => s + ps.grossPay, 0);
      const totalNet = payslips.reduce((s, ps) => s + ps.netPay, 0);
      const paidCount = payslips.filter((ps) => ps.status === "paid").length;
      results.push({
        _id: p._id,
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        finalizedAt: p.finalizedAt,
        staffCount: payslips.length,
        paidCount,
        totalGross,
        totalNet,
      });
    }
    return results;
  },
});

export const getPeriod = query({
  args: { token: v.string(), periodId: v.id("payPeriods") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const period = await ctx.db.get(args.periodId);
    if (!period || period.tenantId !== session.tenantId) {
      throw new Error("Pay period not found");
    }

    const payslips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("payPeriodId", args.periodId))
      .collect();

    const sorted = payslips.sort((a, b) => a.userName.localeCompare(b.userName));

    return {
      _id: period._id,
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt,
      payslips: sorted.map((ps) => ({
        _id: ps._id,
        userId: ps.userId,
        userName: ps.userName,
        regularMinutes: ps.regularMinutes,
        overtimeMinutes: ps.overtimeMinutes,
        hourlyRateSnapshot: ps.hourlyRateSnapshot,
        grossPay: ps.grossPay,
        allowancesTotal: ps.allowances.reduce((s, a) => s + a.amount, 0),
        deductionsTotal: ps.deductions.reduce((s, d) => s + d.amount, 0),
        netPay: ps.netPay,
        status: ps.status,
        paidAt: ps.paidAt,
        paidVia: ps.paidVia,
      })),
    };
  },
});

export const getPayslipDetail = query({
  args: { token: v.string(), payslipId: v.id("payslips") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const payslip = await ctx.db.get(args.payslipId);
    if (!payslip || payslip.tenantId !== session.tenantId) {
      throw new Error("Payslip not found");
    }

    const period = await ctx.db.get(payslip.payPeriodId);
    if (!period) throw new Error("Pay period missing");

    const tenant = await ctx.db.get(session.tenantId);

    // Pull all completed timesheets for this user in the period range
    const allUserSheets = await ctx.db
      .query("timesheets")
      .withIndex("by_user", (q) => q.eq("userId", payslip.userId))
      .collect();

    const inRange = allUserSheets.filter((ts) => {
      if (ts.status !== "completed" && ts.status !== "auto_closed") return false;
      const t = ts.clockOutAt ?? ts.clockInAt;
      return t >= period.startDate && t <= period.endDate;
    });

    inRange.sort((a, b) => a.clockInAt - b.clockInAt);

    const days = inRange.map((ts) => ({
      _id: ts._id,
      clockInAt: ts.clockInAt,
      clockOutAt: ts.clockOutAt ?? null,
      workMinutes: ts.workMinutes ?? 0,
      breakMinutes: ts.breakMinutes ?? 0,
      overtimeMinutes: ts.overtimeMinutes ?? 0,
      earnedAmount: ts.earnedAmount ?? 0,
    }));

    return {
      _id: payslip._id,
      payPeriodId: payslip.payPeriodId,
      periodLabel: period.label,
      periodStart: period.startDate,
      periodEnd: period.endDate,
      periodStatus: period.status,
      tenantName: tenant?.name ?? "",
      currency: tenant?.currency ?? "PHP",
      userId: payslip.userId,
      userName: payslip.userName,
      regularMinutes: payslip.regularMinutes,
      overtimeMinutes: payslip.overtimeMinutes,
      hourlyRateSnapshot: payslip.hourlyRateSnapshot,
      overtimeMultiplier: payslip.overtimeMultiplier,
      grossPay: payslip.grossPay,
      allowances: payslip.allowances,
      deductions: payslip.deductions,
      netPay: payslip.netPay,
      status: payslip.status,
      paidAt: payslip.paidAt,
      paidVia: payslip.paidVia,
      paidNote: payslip.paidNote,
      notes: payslip.notes,
      days,
    };
  },
});
