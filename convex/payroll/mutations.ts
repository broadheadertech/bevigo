import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import { Id, Doc } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

const DEFAULT_OT_MULTIPLIER = 12500; // 1.25x in basis points

async function loadTenantSettings(
  ctx: MutationCtx,
  tenantId: Id<"tenants">
): Promise<Doc<"tenantSettings"> | null> {
  return await ctx.db
    .query("tenantSettings")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .unique();
}

type GeneratedPayslip = {
  userId: Id<"users">;
  userName: string;
  regularMinutes: number;
  overtimeMinutes: number;
  hourlyRateSnapshot: number;
  grossPay: number;
  allowances: { label: string; amount: number }[];
  deductions: { label: string; amount: number; loanId?: Id<"staffLoans"> }[];
};

async function buildPayslipForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  periodStart: number,
  periodEnd: number,
  otMultiplierBps: number
): Promise<GeneratedPayslip> {
  const sheets = await ctx.db
    .query("timesheets")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let grossPay = 0;

  for (const ts of sheets) {
    if (ts.status !== "completed" && ts.status !== "auto_closed") continue;
    const t = ts.clockOutAt ?? ts.clockInAt;
    if (t < periodStart || t > periodEnd) continue;
    const work = ts.workMinutes ?? 0;
    const ot = ts.overtimeMinutes ?? 0;
    regularMinutes += Math.max(0, work - ot);
    overtimeMinutes += ot;
    grossPay += ts.earnedAmount ?? 0;
  }

  // If timesheets didn't have earnedAmount snapshots, fall back to live calc
  const hourlyRate = user.hourlyRate ?? 0;
  if (grossPay === 0 && hourlyRate > 0 && (regularMinutes > 0 || overtimeMinutes > 0)) {
    const regPay = Math.round((regularMinutes / 60) * hourlyRate);
    const otPay = Math.round(
      (overtimeMinutes / 60) * hourlyRate * (otMultiplierBps / 10000)
    );
    grossPay = regPay + otPay;
  }

  // Recurring deductions
  const recurring = await ctx.db
    .query("staffRecurringDeductions")
    .withIndex("by_user_active", (q) => q.eq("userId", user._id).eq("active", true))
    .collect();
  const deductions: GeneratedPayslip["deductions"] = recurring.map((r) => ({
    label: r.label,
    amount: r.amount,
  }));

  // Active loans
  const loans = await ctx.db
    .query("staffLoans")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", user._id).eq("status", "active")
    )
    .collect();
  for (const loan of loans) {
    if (loan.balanceRemaining <= 0) continue;
    const amt = Math.min(loan.perPeriodDeduction, loan.balanceRemaining);
    deductions.push({
      label: `Loan repayment (₱${(loan.balanceRemaining / 100).toFixed(2)} remaining)`,
      amount: amt,
      loanId: loan._id,
    });
  }

  return {
    userId: user._id,
    userName: user.name,
    regularMinutes,
    overtimeMinutes,
    hourlyRateSnapshot: hourlyRate,
    grossPay,
    allowances: [],
    deductions,
  };
}

export const createPeriod = mutation({
  args: {
    token: v.string(),
    label: v.string(),
    startDate: v.number(), // ms at start of day
    endDate: v.number(), // ms at end of day
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    if (!args.label.trim()) throw new Error("Label is required");
    if (args.endDate < args.startDate)
      throw new Error("End date must be on or after start date");

    const settings = await loadTenantSettings(ctx, session.tenantId);
    const otMultiplier = settings?.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER;

    const now = Date.now();
    const periodId = await ctx.db.insert("payPeriods", {
      tenantId: session.tenantId,
      label: args.label.trim(),
      startDate: args.startDate,
      endDate: args.endDate,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    // Generate draft payslips for active staff
    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", session.tenantId).eq("status", "active")
      )
      .collect();

    let generated = 0;
    for (const user of allUsers) {
      const draft = await buildPayslipForUser(
        ctx,
        user,
        args.startDate,
        args.endDate,
        otMultiplier
      );
      // Skip users with zero gross + zero allowances + zero deductions to avoid clutter
      if (
        draft.grossPay === 0 &&
        draft.regularMinutes === 0 &&
        draft.overtimeMinutes === 0 &&
        draft.deductions.length === 0
      ) {
        continue;
      }
      const totalAllowances = draft.allowances.reduce((s, a) => s + a.amount, 0);
      const totalDeductions = draft.deductions.reduce((s, d) => s + d.amount, 0);
      const netPay = draft.grossPay + totalAllowances - totalDeductions;

      await ctx.db.insert("payslips", {
        tenantId: session.tenantId,
        payPeriodId: periodId,
        userId: draft.userId,
        userName: draft.userName,
        regularMinutes: draft.regularMinutes,
        overtimeMinutes: draft.overtimeMinutes,
        hourlyRateSnapshot: draft.hourlyRateSnapshot,
        overtimeMultiplier: otMultiplier,
        grossPay: draft.grossPay,
        allowances: draft.allowances,
        deductions: draft.deductions,
        netPay,
        status: "draft",
        updatedAt: now,
      });
      generated++;
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "pay_period_created",
      "payPeriods",
      periodId,
      { label: args.label, generated }
    );

    return { periodId, generated };
  },
});

export const regeneratePayslip = mutation({
  args: { token: v.string(), payslipId: v.id("payslips") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const payslip = await ctx.db.get(args.payslipId);
    if (!payslip || payslip.tenantId !== session.tenantId)
      throw new Error("Payslip not found");
    if (payslip.status !== "draft")
      throw new Error("Only draft payslips can be regenerated");

    const period = await ctx.db.get(payslip.payPeriodId);
    if (!period) throw new Error("Pay period missing");

    const user = await ctx.db.get(payslip.userId);
    if (!user) throw new Error("Staff missing");

    const settings = await loadTenantSettings(ctx, session.tenantId);
    const otMultiplier = settings?.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER;

    const fresh = await buildPayslipForUser(
      ctx,
      user,
      period.startDate,
      period.endDate,
      otMultiplier
    );

    const totalAllowances = fresh.allowances.reduce((s, a) => s + a.amount, 0);
    const totalDeductions = fresh.deductions.reduce((s, d) => s + d.amount, 0);
    const netPay = fresh.grossPay + totalAllowances - totalDeductions;

    await ctx.db.patch(args.payslipId, {
      regularMinutes: fresh.regularMinutes,
      overtimeMinutes: fresh.overtimeMinutes,
      hourlyRateSnapshot: fresh.hourlyRateSnapshot,
      grossPay: fresh.grossPay,
      allowances: fresh.allowances,
      deductions: fresh.deductions,
      netPay,
      updatedAt: Date.now(),
    });
  },
});

export const updatePayslipLines = mutation({
  args: {
    token: v.string(),
    payslipId: v.id("payslips"),
    allowances: v.array(
      v.object({ label: v.string(), amount: v.number() })
    ),
    deductions: v.array(
      v.object({
        label: v.string(),
        amount: v.number(),
        loanId: v.optional(v.id("staffLoans")),
      })
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const payslip = await ctx.db.get(args.payslipId);
    if (!payslip || payslip.tenantId !== session.tenantId)
      throw new Error("Payslip not found");
    if (payslip.status !== "draft")
      throw new Error("Only draft payslips can be edited");

    const cleanAllowances = args.allowances
      .filter((a) => a.label.trim() && Number.isFinite(a.amount) && a.amount > 0)
      .map((a) => ({ label: a.label.trim(), amount: Math.round(a.amount) }));
    const cleanDeductions = args.deductions
      .filter((d) => d.label.trim() && Number.isFinite(d.amount) && d.amount > 0)
      .map((d) => ({
        label: d.label.trim(),
        amount: Math.round(d.amount),
        loanId: d.loanId,
      }));

    const totalA = cleanAllowances.reduce((s, a) => s + a.amount, 0);
    const totalD = cleanDeductions.reduce((s, d) => s + d.amount, 0);
    const netPay = payslip.grossPay + totalA - totalD;

    await ctx.db.patch(args.payslipId, {
      allowances: cleanAllowances,
      deductions: cleanDeductions,
      netPay,
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

export const finalizePeriod = mutation({
  args: { token: v.string(), periodId: v.id("payPeriods") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const period = await ctx.db.get(args.periodId);
    if (!period || period.tenantId !== session.tenantId)
      throw new Error("Pay period not found");
    if (period.status === "finalized")
      throw new Error("Period already finalized");

    const now = Date.now();
    await ctx.db.patch(args.periodId, {
      status: "finalized",
      finalizedAt: now,
      finalizedBy: session.userId,
      updatedAt: now,
    });

    const payslips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("payPeriodId", args.periodId))
      .collect();
    for (const ps of payslips) {
      if (ps.status === "draft") {
        await ctx.db.patch(ps._id, { status: "finalized", updatedAt: now });
      }
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "pay_period_finalized",
      "payPeriods",
      args.periodId,
      { payslipCount: payslips.length }
    );
  },
});

export const markPayslipPaid = mutation({
  args: {
    token: v.string(),
    payslipId: v.id("payslips"),
    paidVia: v.union(
      v.literal("cash"),
      v.literal("bank"),
      v.literal("gcash"),
      v.literal("maya"),
      v.literal("other")
    ),
    paidAt: v.optional(v.number()),
    paidNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const payslip = await ctx.db.get(args.payslipId);
    if (!payslip || payslip.tenantId !== session.tenantId)
      throw new Error("Payslip not found");
    if (payslip.status === "paid")
      throw new Error("Payslip already marked as paid");
    if (payslip.status === "draft")
      throw new Error("Finalize the period before marking paid");

    const now = Date.now();
    const paidAt = args.paidAt ?? now;

    await ctx.db.patch(args.payslipId, {
      status: "paid",
      paidVia: args.paidVia,
      paidAt,
      paidNote: args.paidNote?.trim() || undefined,
      updatedAt: now,
    });

    // Apply loan repayments tied to this payslip
    for (const ded of payslip.deductions) {
      if (!ded.loanId) continue;
      const loan = await ctx.db.get(ded.loanId);
      if (!loan || loan.tenantId !== session.tenantId) continue;
      if (loan.status !== "active") continue;

      const newBalance = Math.max(0, loan.balanceRemaining - ded.amount);
      const update: Record<string, unknown> = {
        balanceRemaining: newBalance,
        updatedAt: now,
      };
      if (newBalance === 0) {
        update.status = "paid_off";
        update.completedAt = now;
      }
      await ctx.db.patch(loan._id, update);

      await ctx.db.insert("staffLoanPayments", {
        tenantId: session.tenantId,
        loanId: loan._id,
        payslipId: payslip._id,
        amount: ded.amount,
        paidAt,
      });
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "payslip_paid",
      "payslips",
      args.payslipId,
      { paidVia: args.paidVia, netPay: payslip.netPay }
    );
  },
});

export const deletePeriod = mutation({
  args: { token: v.string(), periodId: v.id("payPeriods") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const period = await ctx.db.get(args.periodId);
    if (!period || period.tenantId !== session.tenantId)
      throw new Error("Pay period not found");
    if (period.status === "finalized")
      throw new Error("Cannot delete a finalized period");

    const payslips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("payPeriodId", args.periodId))
      .collect();
    for (const ps of payslips) {
      await ctx.db.delete(ps._id);
    }
    await ctx.db.delete(args.periodId);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "pay_period_deleted",
      "payPeriods",
      args.periodId,
      { label: period.label }
    );
  },
});
