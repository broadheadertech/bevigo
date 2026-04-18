import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const addRecurringDeduction = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    label: v.string(),
    amount: v.number(), // cents
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const target = await ctx.db.get(args.userId);
    if (!target || target.tenantId !== session.tenantId) {
      throw new Error("Staff not found");
    }
    if (!args.label.trim()) throw new Error("Label is required");
    if (!Number.isFinite(args.amount) || args.amount <= 0)
      throw new Error("Amount must be greater than zero");

    const now = Date.now();
    const id = await ctx.db.insert("staffRecurringDeductions", {
      tenantId: session.tenantId,
      userId: args.userId,
      label: args.label.trim(),
      amount: Math.round(args.amount),
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "recurring_deduction_added",
      "staffRecurringDeductions",
      id,
      { userId: args.userId, label: args.label, amount: args.amount }
    );

    return id;
  },
});

export const updateRecurringDeduction = mutation({
  args: {
    token: v.string(),
    deductionId: v.id("staffRecurringDeductions"),
    label: v.optional(v.string()),
    amount: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const ded = await ctx.db.get(args.deductionId);
    if (!ded || ded.tenantId !== session.tenantId) {
      throw new Error("Deduction not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.label !== undefined) updates.label = args.label.trim();
    if (args.amount !== undefined) updates.amount = Math.round(args.amount);
    if (args.active !== undefined) updates.active = args.active;
    await ctx.db.patch(args.deductionId, updates);
  },
});

export const removeRecurringDeduction = mutation({
  args: {
    token: v.string(),
    deductionId: v.id("staffRecurringDeductions"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const ded = await ctx.db.get(args.deductionId);
    if (!ded || ded.tenantId !== session.tenantId) {
      throw new Error("Deduction not found");
    }
    await ctx.db.delete(args.deductionId);
  },
});

export const issueLoan = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    principal: v.number(), // cents
    perPeriodDeduction: v.number(), // cents
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const target = await ctx.db.get(args.userId);
    if (!target || target.tenantId !== session.tenantId) {
      throw new Error("Staff not found");
    }
    if (!Number.isFinite(args.principal) || args.principal <= 0)
      throw new Error("Principal must be greater than zero");
    if (
      !Number.isFinite(args.perPeriodDeduction) ||
      args.perPeriodDeduction <= 0
    )
      throw new Error("Per-period deduction must be greater than zero");
    if (args.perPeriodDeduction > args.principal)
      throw new Error("Per-period deduction cannot exceed principal");

    const now = Date.now();
    const id = await ctx.db.insert("staffLoans", {
      tenantId: session.tenantId,
      userId: args.userId,
      principal: Math.round(args.principal),
      balanceRemaining: Math.round(args.principal),
      perPeriodDeduction: Math.round(args.perPeriodDeduction),
      status: "active",
      notes: args.notes?.trim() || undefined,
      issuedAt: now,
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "loan_issued",
      "staffLoans",
      id,
      {
        userId: args.userId,
        principal: args.principal,
        perPeriodDeduction: args.perPeriodDeduction,
      }
    );

    return id;
  },
});

export const updateLoan = mutation({
  args: {
    token: v.string(),
    loanId: v.id("staffLoans"),
    perPeriodDeduction: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("cancelled"))
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const loan = await ctx.db.get(args.loanId);
    if (!loan || loan.tenantId !== session.tenantId) {
      throw new Error("Loan not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.perPeriodDeduction !== undefined) {
      if (
        !Number.isFinite(args.perPeriodDeduction) ||
        args.perPeriodDeduction <= 0
      )
        throw new Error("Per-period deduction must be greater than zero");
      updates.perPeriodDeduction = Math.round(args.perPeriodDeduction);
    }
    if (args.notes !== undefined) updates.notes = args.notes.trim() || undefined;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.loanId, updates);
  },
});
