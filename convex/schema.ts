import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const operatingHoursDay = v.optional(
  v.object({ open: v.string(), close: v.string() })
);

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    slug: v.string(),
    currency: v.string(),
    timezone: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended")),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  locations: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    slug: v.string(),
    address: v.optional(v.string()),
    timezone: v.string(),
    taxRate: v.number(),
    taxLabel: v.string(),
    currency: v.string(),
    operatingHours: v.object({
      monday: operatingHoursDay,
      tuesday: operatingHoursDay,
      wednesday: operatingHoursDay,
      thursday: operatingHoursDay,
      friday: operatingHoursDay,
      saturday: operatingHoursDay,
      sunday: operatingHoursDay,
    }),
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_slug", ["slug"]),

  users: defineTable({
    tenantId: v.id("tenants"),
    email: v.optional(v.string()),
    googleId: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    name: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("manager"),
      v.literal("barista")
    ),
    quickPinHash: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_email", ["tenantId", "email"])
    .index("by_google_id", ["googleId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  userLocations: defineTable({
    userId: v.id("users"),
    locationId: v.id("locations"),
    tenantId: v.id("tenants"),
  })
    .index("by_user", ["userId"])
    .index("by_location", ["locationId"])
    .index("by_tenant", ["tenantId"])
    .index("by_user_location", ["userId", "locationId"]),

  sessions: defineTable({
    userId: v.id("users"),
    tenantId: v.id("tenants"),
    token: v.string(),
    expiresAt: v.number(),
    deviceInfo: v.optional(v.string()),
    lockedAt: v.optional(v.number()),
    locationId: v.optional(v.id("locations")),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"])
    .index("by_expiry", ["expiresAt"]),

  tenantSettings: defineTable({
    tenantId: v.id("tenants"),
    idleLockTimeoutMs: v.number(),
    reportEmail: v.optional(v.string()),
    reportFrequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("none"))),
    // Branding fields (Epic 15)
    brandName: v.optional(v.string()),
    brandLogoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    // Custom domain (Epic 15)
    customDomain: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  pinFailures: defineTable({
    locationId: v.id("locations"),
    deviceToken: v.string(),
    failureCount: v.number(),
    lastFailureAt: v.number(),
  }).index("by_device_location", ["deviceToken", "locationId"]),

  categories: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    sortOrder: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_sort", ["tenantId", "sortOrder"]),

  menuItems: defineTable({
    tenantId: v.id("tenants"),
    categoryId: v.id("categories"),
    name: v.string(),
    description: v.optional(v.string()),
    basePrice: v.number(),
    sku: v.optional(v.string()),
    isFeatured: v.boolean(),
    sortOrder: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_category", ["tenantId", "categoryId"])
    .index("by_tenant_featured", ["tenantId", "isFeatured"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_tenant_sku", ["tenantId", "sku"]),

  modifierGroups: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    required: v.boolean(),
    minSelect: v.number(),
    maxSelect: v.number(),
    sortOrder: v.number(),
    updatedAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  modifiers: defineTable({
    tenantId: v.id("tenants"),
    groupId: v.id("modifierGroups"),
    name: v.string(),
    priceAdjustment: v.number(),
    sortOrder: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_tenant", ["tenantId"]),

  menuItemModifierGroups: defineTable({
    menuItemId: v.id("menuItems"),
    modifierGroupId: v.id("modifierGroups"),
    tenantId: v.id("tenants"),
  })
    .index("by_menu_item", ["menuItemId"])
    .index("by_modifier_group", ["modifierGroupId"])
    .index("by_tenant", ["tenantId"]),

  locationPriceOverrides: defineTable({
    menuItemId: v.id("menuItems"),
    locationId: v.id("locations"),
    tenantId: v.id("tenants"),
    price: v.number(),
    updatedAt: v.number(),
  })
    .index("by_menu_item", ["menuItemId"])
    .index("by_location", ["locationId"])
    .index("by_menu_item_location", ["menuItemId", "locationId"])
    .index("by_tenant", ["tenantId"]),

  orders: defineTable({
    tenantId: v.id("tenants"),
    locationId: v.id("locations"),
    userId: v.id("users"),
    orderNumber: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("completed"),
      v.literal("voided"),
      v.literal("abandoned")
    ),
    subtotal: v.number(),
    taxAmount: v.number(),
    total: v.number(),
    paymentType: v.optional(
      v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet"))
    ),
    taxRate: v.number(),
    taxLabel: v.string(),
    customerId: v.optional(v.id("customers")),
    voidedBy: v.optional(v.id("users")),
    voidReason: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_location", ["tenantId", "locationId"])
    .index("by_tenant_location_status", ["tenantId", "locationId", "status"])
    .index("by_tenant_location_date", ["tenantId", "locationId", "completedAt"])
    .index("by_user", ["userId"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    menuItemId: v.id("menuItems"),
    tenantId: v.id("tenants"),
    itemName: v.string(),
    basePrice: v.number(),
    quantity: v.number(),
    subtotal: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_tenant", ["tenantId"]),

  orderItemModifiers: defineTable({
    orderItemId: v.id("orderItems"),
    tenantId: v.id("tenants"),
    modifierName: v.string(),
    priceAdjustment: v.number(),
  })
    .index("by_order_item", ["orderItemId"])
    .index("by_tenant", ["tenantId"]),

  // ── Inventory Management ──

  ingredients: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    unit: v.string(), // "g", "ml", "pcs", "kg", "L"
    category: v.optional(v.string()), // "Coffee", "Dairy", "Supplies", etc.
    reorderThreshold: v.number(), // alert when stock falls below this
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  ingredientStock: defineTable({
    ingredientId: v.id("ingredients"),
    locationId: v.id("locations"),
    tenantId: v.id("tenants"),
    quantity: v.number(), // current stock in the ingredient's unit
    updatedAt: v.number(),
  })
    .index("by_ingredient", ["ingredientId"])
    .index("by_location", ["locationId"])
    .index("by_ingredient_location", ["ingredientId", "locationId"])
    .index("by_tenant", ["tenantId"]),

  recipes: defineTable({
    menuItemId: v.id("menuItems"),
    ingredientId: v.id("ingredients"),
    tenantId: v.id("tenants"),
    quantityUsed: v.number(), // amount consumed per 1 unit of the menu item
  })
    .index("by_menu_item", ["menuItemId"])
    .index("by_ingredient", ["ingredientId"])
    .index("by_tenant", ["tenantId"]),

  purchaseOrders: defineTable({
    tenantId: v.id("tenants"),
    locationId: v.id("locations"),
    userId: v.id("users"),
    supplier: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("ordered"),
      v.literal("received"),
      v.literal("cancelled")
    ),
    notes: v.optional(v.string()),
    orderedAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_location", ["tenantId", "locationId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  purchaseOrderItems: defineTable({
    purchaseOrderId: v.id("purchaseOrders"),
    ingredientId: v.id("ingredients"),
    tenantId: v.id("tenants"),
    quantityOrdered: v.number(),
    quantityReceived: v.optional(v.number()),
    unitCost: v.optional(v.number()), // cost per unit in smallest currency
  })
    .index("by_purchase_order", ["purchaseOrderId"])
    .index("by_tenant", ["tenantId"]),

  stockAdjustments: defineTable({
    ingredientId: v.id("ingredients"),
    locationId: v.id("locations"),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.union(
      v.literal("wastage"),
      v.literal("correction"),
      v.literal("stocktake"),
      v.literal("transfer")
    ),
    quantity: v.number(), // negative for removal, positive for addition
    reason: v.string(),
    createdAt: v.number(),
  })
    .index("by_ingredient", ["ingredientId"])
    .index("by_location", ["locationId"])
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_type", ["tenantId", "type"]),

  shifts: defineTable({
    tenantId: v.id("tenants"),
    locationId: v.id("locations"),
    userId: v.id("users"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    openingCash: v.number(),
    closingCash: v.optional(v.number()),
    expectedCash: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("closed")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_location", ["tenantId", "locationId"])
    .index("by_tenant_location_status", ["tenantId", "locationId", "status"])
    .index("by_user", ["userId"]),

  // ── Customer Engagement ──

  customers: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    visitCount: v.number(),
    totalSpent: v.number(),
    lastVisitAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_phone", ["tenantId", "phone"])
    .index("by_tenant_email", ["tenantId", "email"]),

  loyaltyCards: defineTable({
    customerId: v.id("customers"),
    tenantId: v.id("tenants"),
    stampsEarned: v.number(),
    stampsRequired: v.number(),
    status: v.union(v.literal("active"), v.literal("redeemed"), v.literal("expired")),
    redeemedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_tenant", ["tenantId"])
    .index("by_customer_status", ["customerId", "status"]),

  subscriptionPlans: defineTable({
    name: v.string(),
    slug: v.string(),
    maxLocations: v.number(),
    maxOrdersPerMonth: v.number(),
    priceMonthly: v.number(),
    priceYearly: v.number(),
    features: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_slug", ["slug"]),

  tenantSubscriptions: defineTable({
    tenantId: v.id("tenants"),
    planId: v.id("subscriptionPlans"),
    status: v.union(v.literal("active"), v.literal("past_due"), v.literal("cancelled"), v.literal("trial")),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    monthlyOrderCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["status"]),

  auditLog: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    changes: v.any(),
    ipAddress: v.optional(v.string()),
  })
    .index("by_tenant_entity", ["tenantId", "entityType", "entityId"])
    .index("by_tenant_date", ["tenantId"]),
});
