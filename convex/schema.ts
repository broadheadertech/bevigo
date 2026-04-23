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
    hourlyRate: v.optional(v.number()), // hourly rate in cents (e.g. 10000 = ₱100/hr)
    referencePhotoId: v.optional(v.id("_storage")), // reference face for face recognition
    faceDescriptor: v.optional(v.array(v.number())), // 128-d face descriptor from face-api.js
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

  // Timesheets — clock in/out for payroll
  timesheets: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    locationId: v.id("locations"),
    clockInAt: v.number(),
    clockOutAt: v.optional(v.number()),
    workMinutes: v.optional(v.number()), // calculated on clock-out (excludes breaks)
    breakMinutes: v.optional(v.number()), // total break time in minutes
    hourlyRate: v.optional(v.number()), // snapshot at clock-out
    earnedAmount: v.optional(v.number()), // (workMinutes - overtimeMinutes)/60 * hourlyRate + overtimeMinutes/60 * hourlyRate * otMultiplier
    overtimeMinutes: v.optional(v.number()), // calculated minutes over the daily threshold
    overtimeAmount: v.optional(v.number()), // OT pay portion
    clockInPhotoId: v.optional(v.id("_storage")), // photo captured at clock-in
    clockOutPhotoId: v.optional(v.id("_storage")), // photo captured at clock-out
    clockInFaceMatch: v.optional(v.number()), // 0-1 confidence score from face match
    clockOutFaceMatch: v.optional(v.number()),
    photoFlagged: v.optional(v.boolean()), // flagged for review by owner/manager
    status: v.union(
      v.literal("active"),
      v.literal("on_break"),
      v.literal("completed"),
      v.literal("auto_closed")
    ),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    editedBy: v.optional(v.id("users")),
    editedAt: v.optional(v.number()),
    editReason: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_tenant_location", ["tenantId", "locationId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  // Break entries — multiple breaks per timesheet
  timesheetBreaks: defineTable({
    timesheetId: v.id("timesheets"),
    tenantId: v.id("tenants"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    type: v.union(v.literal("paid"), v.literal("unpaid")), // paid breaks count toward work time
  })
    .index("by_timesheet", ["timesheetId"])
    .index("by_tenant", ["tenantId"]),

  // Edit history for timesheets — full audit trail
  timesheetEdits: defineTable({
    timesheetId: v.id("timesheets"),
    tenantId: v.id("tenants"),
    editedBy: v.id("users"),
    field: v.string(), // "clockInAt", "clockOutAt", "notes", etc.
    oldValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_timesheet", ["timesheetId"])
    .index("by_tenant", ["tenantId"]),

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
    sendPartialReport: v.optional(v.boolean()), // mid-day snapshot
    partialReportTime: v.optional(v.string()), // "HH:MM" in tenant timezone, default "14:00"
    dailyReportTime: v.optional(v.string()), // "HH:MM" for end-of-day, default "22:00"
    lastPartialReportAt: v.optional(v.number()),
    lastDailyReportAt: v.optional(v.number()),
    // Branding fields (Epic 15)
    brandName: v.optional(v.string()),
    brandLogoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    // Custom domain (Epic 15)
    customDomain: v.optional(v.string()),
    // Points earn rate: 1 point per X cents spent (default: 1000 = 1pt per ₱10)
    pointsEarnRate: v.optional(v.number()),
    // Overtime config
    overtimeDailyHours: v.optional(v.number()), // hours per day before OT kicks in (default 8)
    overtimeMultiplier: v.optional(v.number()), // OT pay multiplier in basis points (12500 = 1.25x)
    autoClockOutHours: v.optional(v.number()), // hours after which active timesheet auto-closes (default 12)
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
    imageId: v.optional(v.id("_storage")),
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
    isDefault: v.optional(v.boolean()),
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
      v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet"), v.literal("split"))
    ),
    payments: v.optional(v.array(v.object({
      type: v.union(v.literal("cash"), v.literal("card"), v.literal("ewallet")),
      amount: v.number(),
      tendered: v.optional(v.number()), // cash only: amount handed over
      change: v.optional(v.number()), // cash only: change returned
    }))),
    taxRate: v.number(),
    taxLabel: v.string(),
    // Refund fields
    refundedAt: v.optional(v.number()),
    refundedBy: v.optional(v.id("users")),
    refundReason: v.optional(v.string()),
    refundAmount: v.optional(v.number()), // partial or full refund amount
    // Discount fields
    discountType: v.optional(v.union(v.literal("percentage"), v.literal("fixed"))),
    discountValue: v.optional(v.number()), // percentage (e.g., 10 = 10%) or fixed amount in cents
    discountAmount: v.optional(v.number()), // calculated discount in cents
    discountReason: v.optional(v.string()), // "Senior/PWD", "Employee", "Manager", "Custom"
    discountApprovedBy: v.optional(v.id("users")), // manager/owner who approved
    customerId: v.optional(v.id("customers")),
    customerLabel: v.optional(v.string()), // universal name for walk-in stickers
    tableId: v.optional(v.id("tables")),
    tableName: v.optional(v.string()),
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
    customerLabel: v.optional(v.string()), // per-item customer name for stickers (e.g. "John")
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
    // If set, this row only applies when the order item carries a modifier
    // with this name (e.g. "500ml"). Variant rows fully replace the base
    // recipe for deduction; if no variantKey matches a chosen modifier, base
    // rows (variantKey === undefined) are used.
    variantKey: v.optional(v.string()),
  })
    .index("by_menu_item", ["menuItemId"])
    .index("by_ingredient", ["ingredientId"])
    .index("by_tenant", ["tenantId"]),

  // Per-modifier-option ingredient deduction. When a modifier (e.g.
  // "Oat Milk", "Extra shot", "Whipped Cream") is chosen on an order line,
  // each row here adds quantityUsed × line.quantity to the deduction.
  // If `replacesIngredientId` is set, that ingredient is REMOVED from the
  // base/variant recipe before this row is added — perfect for milk swaps
  // (Oat Milk replaces Regular Milk at the same quantity).
  modifierRecipes: defineTable({
    modifierId: v.id("modifiers"),
    ingredientId: v.id("ingredients"),
    tenantId: v.id("tenants"),
    quantityUsed: v.number(),
    replacesIngredientId: v.optional(v.id("ingredients")),
  })
    .index("by_modifier", ["modifierId"])
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
    customerNumber: v.optional(v.string()), // unique ID like "BG-0001"
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    visitCount: v.number(),
    totalSpent: v.number(),
    pointsBalance: v.optional(v.number()), // accumulated redeemable points
    lastVisitAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_phone", ["tenantId", "phone"])
    .index("by_tenant_email", ["tenantId", "email"])
    .index("by_tenant_customer_number", ["tenantId", "customerNumber"]),

  // Predefined discounts — owner configures, baristas select at register
  discountPresets: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(), // "Senior/PWD", "Employee 20%", "Happy Hour"
    type: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(), // percentage or fixed amount in cents
    reason: v.string(), // auto-fills the reason field
    requiresAuth: v.boolean(), // requires manager PIN
    status: v.union(v.literal("active"), v.literal("inactive")),
    sortOrder: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  // Points transaction history
  pointsLedger: defineTable({
    customerId: v.id("customers"),
    tenantId: v.id("tenants"),
    type: v.union(v.literal("earned"), v.literal("redeemed"), v.literal("expired"), v.literal("adjusted")),
    points: v.number(), // positive for earned, negative for redeemed
    description: v.string(), // "Order #ORD-xxx (₱480)", "Redeemed: Free Latte"
    orderId: v.optional(v.id("orders")),
    rewardId: v.optional(v.id("rewards")),
    createdAt: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_type", ["tenantId", "type"]),

  // Rewards catalog — what customers can redeem points for
  rewards: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(), // "Free Any Drink", "Free Pastry", "bevi&go Mug"
    description: v.optional(v.string()),
    pointsCost: v.number(), // points required to redeem
    category: v.union(v.literal("drink"), v.literal("food"), v.literal("merch"), v.literal("discount")),
    discountAmount: v.optional(v.number()), // for discount type: amount off in cents
    maxValue: v.optional(v.number()), // max product value for "free item" rewards
    status: v.union(v.literal("active"), v.literal("inactive")),
    sortOrder: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),

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

  tables: defineTable({
    tenantId: v.id("tenants"),
    locationId: v.id("locations"),
    name: v.string(), // "Table 1", "Bar 2", "Outdoor A"
    zone: v.optional(v.string()), // legacy free-text label, superseded by floorId/zoneId
    capacity: v.number(), // seats
    sortOrder: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    // Floor-plan positioning (Option C)
    floorId: v.optional(v.id("floors")),
    xPos: v.optional(v.number()), // pixel coords inside the floor canvas
    yPos: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    shape: v.optional(v.union(v.literal("rectangle"), v.literal("circle"))),
    rotation: v.optional(v.number()), // degrees
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_location", ["locationId"])
    .index("by_tenant_location", ["tenantId", "locationId"])
    .index("by_floor", ["floorId"]),

  // Floor-plan canvas — multiple per location (e.g. "1F", "2F", "Patio")
  floors: defineTable({
    tenantId: v.id("tenants"),
    locationId: v.id("locations"),
    name: v.string(),
    sortOrder: v.number(),
    width: v.number(), // canvas width in px (e.g. 1200)
    height: v.number(), // canvas height in px (e.g. 800)
    backgroundImageId: v.optional(v.id("_storage")),
    status: v.union(v.literal("active"), v.literal("inactive")),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_location", ["locationId"])
    .index("by_tenant_location", ["tenantId", "locationId"]),

  // Zone shapes drawn on a floor (e.g. "Outdoor", "Bar")
  tableZones: defineTable({
    tenantId: v.id("tenants"),
    locationId: v.id("locations"),
    floorId: v.id("floors"),
    name: v.string(),
    color: v.string(), // hex, e.g. "#fde68a"
    xPos: v.number(),
    yPos: v.number(),
    width: v.number(),
    height: v.number(),
    rotation: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_floor", ["floorId"])
    .index("by_tenant", ["tenantId"]),

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

  // ── Payroll ──

  payPeriods: defineTable({
    tenantId: v.id("tenants"),
    label: v.string(), // "May 1-15, 2026"
    startDate: v.number(), // ms timestamp at start of day
    endDate: v.number(), // ms timestamp at END of day (inclusive)
    status: v.union(v.literal("draft"), v.literal("finalized")),
    finalizedAt: v.optional(v.number()),
    finalizedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_tenant_start", ["tenantId", "startDate"]),

  payslips: defineTable({
    tenantId: v.id("tenants"),
    payPeriodId: v.id("payPeriods"),
    userId: v.id("users"),
    userName: v.string(), // snapshot
    regularMinutes: v.number(),
    overtimeMinutes: v.number(),
    hourlyRateSnapshot: v.number(), // cents per hour at time of generation
    overtimeMultiplier: v.number(), // basis points (12500 = 1.25x)
    grossPay: v.number(), // cents
    allowances: v.array(
      v.object({ label: v.string(), amount: v.number() })
    ),
    deductions: v.array(
      v.object({
        label: v.string(),
        amount: v.number(),
        loanId: v.optional(v.id("staffLoans")), // tag deductions tied to a loan
      })
    ),
    netPay: v.number(), // cents
    status: v.union(
      v.literal("draft"),
      v.literal("finalized"),
      v.literal("paid")
    ),
    paidAt: v.optional(v.number()),
    paidVia: v.optional(
      v.union(
        v.literal("cash"),
        v.literal("bank"),
        v.literal("gcash"),
        v.literal("maya"),
        v.literal("other")
      )
    ),
    paidNote: v.optional(v.string()),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_period", ["payPeriodId"])
    .index("by_user", ["userId"])
    .index("by_period_user", ["payPeriodId", "userId"]),

  // Recurring per-staff deductions (e.g. SSS, PhilHealth, Pag-IBIG, BIR)
  staffRecurringDeductions: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    label: v.string(),
    amount: v.number(), // cents per period
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "active"]),

  // In-house loans extended to staff, repaid via payroll deductions
  staffLoans: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    principal: v.number(), // total loaned, cents
    balanceRemaining: v.number(), // cents
    perPeriodDeduction: v.number(), // cents auto-deducted each pay period
    status: v.union(
      v.literal("active"),
      v.literal("paid_off"),
      v.literal("cancelled")
    ),
    notes: v.optional(v.string()),
    issuedAt: v.number(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  // Repayment history per loan
  staffLoanPayments: defineTable({
    tenantId: v.id("tenants"),
    loanId: v.id("staffLoans"),
    payslipId: v.id("payslips"),
    amount: v.number(), // cents
    paidAt: v.number(),
  })
    .index("by_loan", ["loanId"])
    .index("by_payslip", ["payslipId"])
    .index("by_tenant", ["tenantId"]),
});
