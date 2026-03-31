import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const listCustomers = query({
  args: {
    token: v.string(),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const allCustomers = await ctx.db
      .query("customers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    let filtered = allCustomers;
    if (args.search) {
      const term = args.search.toLowerCase();
      filtered = allCustomers.filter((c: (typeof allCustomers)[number]) => {
        const nameMatch = c.name.toLowerCase().includes(term);
        const phoneMatch = c.phone?.toLowerCase().includes(term) ?? false;
        return nameMatch || phoneMatch;
      });
    }

    // Sort by lastVisitAt desc (most recent first), nulls last
    filtered.sort((a: (typeof filtered)[number], b: (typeof filtered)[number]) => {
      const aTime = a.lastVisitAt ?? 0;
      const bTime = b.lastVisitAt ?? 0;
      return bTime - aTime;
    });

    // Get active loyalty card for each customer
    const customersWithLoyalty = await Promise.all(
      filtered.map(async (customer: (typeof filtered)[number]) => {
        const activeCards = await ctx.db
          .query("loyaltyCards")
          .withIndex("by_customer_status", (q) =>
            q.eq("customerId", customer._id).eq("status", "active")
          )
          .take(1);
        const activeCard = activeCards[0] ?? null;
        return {
          ...customer,
          loyaltyStamps: activeCard?.stampsEarned ?? 0,
          loyaltyRequired: activeCard?.stampsRequired ?? 10,
          loyaltyCardFull: activeCard
            ? activeCard.stampsEarned >= activeCard.stampsRequired
            : false,
        };
      })
    );

    return customersWithLoyalty;
  },
});

export const getCustomer = query({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      return null;
    }

    return customer;
  },
});

export const findByPhone = query({
  args: {
    token: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const customer = await ctx.db
      .query("customers")
      .withIndex("by_tenant_phone", (q) =>
        q.eq("tenantId", session.tenantId).eq("phone", args.phone)
      )
      .unique();

    if (!customer) return null;

    // Also get active loyalty card
    const activeCards = await ctx.db
      .query("loyaltyCards")
      .withIndex("by_customer_status", (q) =>
        q.eq("customerId", customer._id).eq("status", "active")
      )
      .take(1);
    const activeCard = activeCards[0] ?? null;

    return {
      ...customer,
      loyaltyStamps: activeCard?.stampsEarned ?? 0,
      loyaltyRequired: activeCard?.stampsRequired ?? 10,
      loyaltyCardFull: activeCard
        ? activeCard.stampsEarned >= activeCard.stampsRequired
        : false,
    };
  },
});

export const getLoyaltyCard = query({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Verify customer belongs to tenant
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      return null;
    }

    const activeCards = await ctx.db
      .query("loyaltyCards")
      .withIndex("by_customer_status", (q) =>
        q.eq("customerId", args.customerId).eq("status", "active")
      )
      .take(1);

    return activeCards[0] ?? null;
  },
});

export const getCustomerOrders = query({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Verify customer belongs to tenant
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      return [];
    }

    const take = args.limit ?? 20;

    // Get orders for this tenant that have this customerId
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .order("desc")
      .collect();

    const customerOrders = allOrders
      .filter((o: (typeof allOrders)[number]) => o.customerId === args.customerId && o.status === "completed")
      .slice(0, take);

    // Get items for each order
    const ordersWithItems = await Promise.all(
      customerOrders.map(async (order: (typeof customerOrders)[number]) => {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          completedAt: order.completedAt,
          total: order.total,
          paymentType: order.paymentType,
          items: items.map((item: (typeof items)[number]) => ({
            itemName: item.itemName,
            quantity: item.quantity,
            subtotal: item.subtotal,
          })),
        };
      })
    );

    return ordersWithItems;
  },
});

export const getCustomerFavorites = query({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    // Verify customer belongs to tenant
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== session.tenantId) {
      return [];
    }

    // Get all completed orders for this customer
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .collect();

    const customerOrders = allOrders.filter(
      (o: (typeof allOrders)[number]) => o.customerId === args.customerId && o.status === "completed"
    );

    // Aggregate items by name
    const itemCounts: Record<string, number> = {};
    for (const order of customerOrders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      for (const item of items) {
        const name = item.itemName;
        itemCounts[name] = (itemCounts[name] ?? 0) + item.quantity;
      }
    }

    // Sort by count desc, take top 5
    const sorted = Object.entries(itemCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([itemName, count]: [string, number]) => ({ itemName, count }));

    return sorted;
  },
});
