import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";
import type { Doc } from "../_generated/dataModel";

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const name = args.name.trim();
    if (!name) throw new Error("Supplier name is required");

    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();
    if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`A supplier named "${name}" already exists`);
    }

    const now = Date.now();
    const supplierId = await ctx.db.insert("suppliers", {
      tenantId: session.tenantId,
      name,
      contactName: args.contactName?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      address: args.address?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: "active",
      updatedAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "supplier_created",
      "suppliers",
      supplierId,
      { name }
    );

    return supplierId;
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    supplierId: v.id("suppliers"),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.tenantId !== session.tenantId) {
      throw new Error("Supplier not found");
    }

    const patch: Partial<Doc<"suppliers">> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const newName = args.name.trim();
      if (!newName) throw new Error("Supplier name is required");
      if (newName.toLowerCase() !== supplier.name.toLowerCase()) {
        const all = await ctx.db
          .query("suppliers")
          .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
          .collect();
        if (all.some((s) => s._id !== args.supplierId && s.name.toLowerCase() === newName.toLowerCase())) {
          throw new Error(`A supplier named "${newName}" already exists`);
        }
      }
      patch.name = newName;
    }
    if (args.contactName !== undefined) patch.contactName = args.contactName.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.email !== undefined) patch.email = args.email.trim() || undefined;
    if (args.address !== undefined) patch.address = args.address.trim() || undefined;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(args.supplierId, patch);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "supplier_updated",
      "suppliers",
      args.supplierId,
      patch as Record<string, unknown>
    );

    return args.supplierId;
  },
});

/**
 * Hard-delete a supplier — refuses while ingredients or menu items still
 * reference it. Caller can clear those references first or soft-deactivate
 * via update({ status: "inactive" }) instead.
 */
export const remove = mutation({
  args: { token: v.string(), supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.tenantId !== session.tenantId) {
      throw new Error("Supplier not found");
    }

    const ingredientUses = await ctx.db
      .query("ingredients")
      .withIndex("by_supplier", (q) => q.eq("defaultSupplierId", args.supplierId))
      .collect();
    const menuUses = await ctx.db
      .query("menuItems")
      .withIndex("by_supplier", (q) => q.eq("defaultSupplierId", args.supplierId))
      .collect();
    if (ingredientUses.length > 0 || menuUses.length > 0) {
      throw new Error(
        `Can't delete — still used by ${ingredientUses.length} ingredient(s) and ${menuUses.length} product(s). Reassign them or deactivate this supplier instead.`
      );
    }

    await ctx.db.delete(args.supplierId);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "supplier_deleted",
      "suppliers",
      args.supplierId,
      { name: supplier.name }
    );
  },
});
