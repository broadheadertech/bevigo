import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const createCustomer = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    // Check for duplicate phone within tenant
    if (args.phone) {
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_tenant_phone", (q) =>
          q.eq("tenantId", session.tenantId).eq("phone", args.phone)
        )
        .unique();
      if (existing) {
        throw new Error("A customer with this phone number already exists");
      }
    }

    const now = Date.now();
    const customerId = await ctx.db.insert("customers", {
      tenantId: session.tenantId,
      name: args.name,
      phone: args.phone,
      email: args.email,
      visitCount: 0,
      totalSpent: 0,
      status: "active",
      updatedAt: now,
    });

    // Create initial loyalty card
    await ctx.db.insert("loyaltyCards", {
      customerId,
      tenantId: session.tenantId,
      stampsEarned: 0,
      stampsRequired: 10,
      status: "active",
      createdAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "customer.created",
      "customers",
      customerId,
      { name: args.name, phone: args.phone, email: args.email }
    );

    return customerId;
  },
});

export const updateCustomer = mutation({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    // Check for duplicate phone if changing
    if (args.phone && args.phone !== customer.phone) {
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_tenant_phone", (q) =>
          q.eq("tenantId", session.tenantId).eq("phone", args.phone)
        )
        .unique();
      if (existing) {
        throw new Error("A customer with this phone number already exists");
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.email !== undefined) updates.email = args.email;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.customerId, updates);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "customer.updated",
      "customers",
      args.customerId,
      updates
    );

    return args.customerId;
  },
});

export const addStamp = mutation({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    await addStampInternal(ctx, args.customerId, session.tenantId);
  },
});

/** Internal helper for adding a stamp — used by both the mutation and completeOrder */
export async function addStampInternal(
  ctx: MutationCtx,
  customerId: Id<"customers">,
  tenantId: Id<"tenants">
) {
  // Find active loyalty card
  const activeCards = await ctx.db
    .query("loyaltyCards")
    .withIndex("by_customer_status", (q) =>
      q.eq("customerId", customerId).eq("status", "active")
    )
    .take(1);

  const card = activeCards[0];

  if (!card) {
    // Create a new loyalty card
    const cardId = await ctx.db.insert("loyaltyCards", {
      customerId,
      tenantId,
      stampsEarned: 1,
      stampsRequired: 10,
      status: "active",
      createdAt: Date.now(),
    });
    return cardId;
  }

  // Increment stamps
  const newStamps = card.stampsEarned + 1;
  await ctx.db.patch(card._id, {
    stampsEarned: newStamps,
  });

  return card._id;
}

export const redeemReward = mutation({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager", "barista"]);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      throw new Error("Customer not found");
    }

    // Find active loyalty card that is full
    const activeCards = await ctx.db
      .query("loyaltyCards")
      .withIndex("by_customer_status", (q) =>
        q.eq("customerId", args.customerId).eq("status", "active")
      )
      .take(1);

    const card = activeCards[0];
    if (!card) {
      throw new Error("No active loyalty card found");
    }
    if (card.stampsEarned < card.stampsRequired) {
      throw new Error("Loyalty card is not full yet");
    }

    const now = Date.now();

    // Mark current card as redeemed
    await ctx.db.patch(card._id, {
      status: "redeemed",
      redeemedAt: now,
    });

    // Create new active card
    await ctx.db.insert("loyaltyCards", {
      customerId: args.customerId,
      tenantId: session.tenantId,
      stampsEarned: 0,
      stampsRequired: 10,
      status: "active",
      createdAt: now,
    });

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "loyalty.redeemed",
      "loyaltyCards",
      card._id,
      { customerId: args.customerId, orderId: args.orderId }
    );

    return card._id;
  },
});

/** Quick-create customer from register (barista-accessible) */
export const quickCreate = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Check for duplicate phone within tenant
    if (args.phone) {
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_tenant_phone", (q) =>
          q.eq("tenantId", session.tenantId).eq("phone", args.phone)
        )
        .unique();
      if (existing) {
        throw new Error("A customer with this phone number already exists");
      }
    }

    const now = Date.now();
    const customerId = await ctx.db.insert("customers", {
      tenantId: session.tenantId,
      name: args.name,
      phone: args.phone,
      visitCount: 0,
      totalSpent: 0,
      status: "active",
      updatedAt: now,
    });

    // Create initial loyalty card
    await ctx.db.insert("loyaltyCards", {
      customerId,
      tenantId: session.tenantId,
      stampsEarned: 0,
      stampsRequired: 10,
      status: "active",
      createdAt: now,
    });

    return customerId;
  },
});
