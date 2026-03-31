import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole, requireLocationAccess } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const setPriceOverride = mutation({
  args: {
    token: v.string(),
    menuItemId: v.id("menuItems"),
    locationId: v.id("locations"),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Validate menu item belongs to tenant
    const item = await ctx.db.get(args.menuItemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Validate location belongs to tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    if (args.price <= 0) {
      throw new Error("Price must be a positive integer");
    }

    const now = Date.now();

    // Check for existing override (upsert)
    const existing = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", args.menuItemId).eq("locationId", args.locationId)
      )
      .unique();

    if (existing) {
      const previousPrice = existing.price;
      await ctx.db.patch(existing._id, {
        price: args.price,
        updatedAt: now,
      });

      await logAuditEntry(
        ctx,
        session.tenantId,
        session.userId,
        "price_override_updated",
        "locationPriceOverrides",
        existing._id,
        {
          menuItemId: args.menuItemId,
          locationId: args.locationId,
          previousPrice,
          newPrice: args.price,
        }
      );

      return existing._id;
    } else {
      const overrideId = await ctx.db.insert("locationPriceOverrides", {
        menuItemId: args.menuItemId,
        locationId: args.locationId,
        tenantId: session.tenantId,
        price: args.price,
        updatedAt: now,
      });

      await logAuditEntry(
        ctx,
        session.tenantId,
        session.userId,
        "price_override_created",
        "locationPriceOverrides",
        overrideId,
        {
          menuItemId: args.menuItemId,
          locationId: args.locationId,
          price: args.price,
        }
      );

      return overrideId;
    }
  },
});

export const removePriceOverride = mutation({
  args: {
    token: v.string(),
    menuItemId: v.id("menuItems"),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    // Validate menu item belongs to tenant
    const item = await ctx.db.get(args.menuItemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Validate location belongs to tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    const existing = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", args.menuItemId).eq("locationId", args.locationId)
      )
      .unique();

    if (!existing) {
      throw new Error("No price override found for this item and location");
    }

    await ctx.db.delete(existing._id);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "price_override_removed",
      "locationPriceOverrides",
      existing._id,
      {
        menuItemId: args.menuItemId,
        locationId: args.locationId,
        previousPrice: existing.price,
      }
    );
  },
});

export const updateItemAsManager = mutation({
  args: {
    token: v.string(),
    menuItemId: v.id("menuItems"),
    locationId: v.id("locations"),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["manager", "owner"]);
    requireLocationAccess(session, args.locationId);

    // Validate menu item belongs to tenant
    const item = await ctx.db.get(args.menuItemId);
    if (!item || item.tenantId !== session.tenantId) {
      throw new Error("Menu item not found");
    }

    // Validate location belongs to tenant
    const location = await ctx.db.get(args.locationId);
    if (!location || location.tenantId !== session.tenantId) {
      throw new Error("Location not found");
    }

    if (args.price <= 0) {
      throw new Error("Price must be a positive integer");
    }

    const now = Date.now();

    // Check for existing override (upsert)
    const existing = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_menu_item_location", (q) =>
        q.eq("menuItemId", args.menuItemId).eq("locationId", args.locationId)
      )
      .unique();

    if (existing) {
      const previousPrice = existing.price;
      await ctx.db.patch(existing._id, {
        price: args.price,
        updatedAt: now,
      });

      await logAuditEntry(
        ctx,
        session.tenantId,
        session.userId,
        "manager_price_override_updated",
        "locationPriceOverrides",
        existing._id,
        {
          menuItemId: args.menuItemId,
          locationId: args.locationId,
          previousPrice,
          newPrice: args.price,
        }
      );

      return existing._id;
    } else {
      const overrideId = await ctx.db.insert("locationPriceOverrides", {
        menuItemId: args.menuItemId,
        locationId: args.locationId,
        tenantId: session.tenantId,
        price: args.price,
        updatedAt: now,
      });

      await logAuditEntry(
        ctx,
        session.tenantId,
        session.userId,
        "manager_price_override_created",
        "locationPriceOverrides",
        overrideId,
        {
          menuItemId: args.menuItemId,
          locationId: args.locationId,
          price: args.price,
        }
      );

      return overrideId;
    }
  },
});
