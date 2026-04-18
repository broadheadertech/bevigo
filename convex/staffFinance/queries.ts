import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";

export const listForUser = query({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const target = await ctx.db.get(args.userId);
    if (!target || target.tenantId !== session.tenantId) {
      throw new Error("Staff not found");
    }

    const deductions = await ctx.db
      .query("staffRecurringDeductions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const loans = await ctx.db
      .query("staffLoans")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      deductions: deductions
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((d) => ({
          _id: d._id,
          label: d.label,
          amount: d.amount,
          active: d.active,
        })),
      loans: loans
        .sort((a, b) => b.issuedAt - a.issuedAt)
        .map((l) => ({
          _id: l._id,
          principal: l.principal,
          balanceRemaining: l.balanceRemaining,
          perPeriodDeduction: l.perPeriodDeduction,
          status: l.status,
          notes: l.notes,
          issuedAt: l.issuedAt,
          completedAt: l.completedAt,
        })),
    };
  },
});

export const listLoanPayments = query({
  args: { token: v.string(), loanId: v.id("staffLoans") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const loan = await ctx.db.get(args.loanId);
    if (!loan || loan.tenantId !== session.tenantId) {
      throw new Error("Loan not found");
    }

    const payments = await ctx.db
      .query("staffLoanPayments")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    return payments
      .sort((a, b) => b.paidAt - a.paidAt)
      .map((p) => ({
        _id: p._id,
        amount: p.amount,
        paidAt: p.paidAt,
        payslipId: p.payslipId,
      }));
  },
});
