import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const previewClone = query({
  args: {
    token: v.string(),
    sourceLocationId: v.id("locations"),
    targetLocationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    if (args.sourceLocationId === args.targetLocationId) {
      throw new Error("Source and target locations must be different");
    }

    // Validate both locations belong to tenant
    const sourceLocation = await ctx.db.get(args.sourceLocationId);
    if (!sourceLocation || sourceLocation.tenantId !== session.tenantId) {
      throw new Error("Source location not found");
    }

    const targetLocation = await ctx.db.get(args.targetLocationId);
    if (!targetLocation || targetLocation.tenantId !== session.tenantId) {
      throw new Error("Target location not found");
    }

    // Get all source overrides
    const sourceOverrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_location", (q) => q.eq("locationId", args.sourceLocationId))
      .collect();

    const filteredSourceOverrides = sourceOverrides.filter(
      (o) => o.tenantId === session.tenantId
    );

    // Get all target overrides for conflict detection
    const targetOverrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_location", (q) => q.eq("locationId", args.targetLocationId))
      .collect();

    const targetOverrideMap = new Map<string, number>();
    for (const o of targetOverrides) {
      if (o.tenantId === session.tenantId) {
        targetOverrideMap.set(o.menuItemId, o.price);
      }
    }

    // Resolve item names and build result
    const sourceOverrideResults: Array<{
      menuItemId: string;
      itemName: string;
      price: number;
    }> = [];

    const conflicts: Array<{
      menuItemId: string;
      itemName: string;
      sourcePrice: number;
      targetPrice: number;
    }> = [];

    for (const override of filteredSourceOverrides) {
      const item = await ctx.db.get(override.menuItemId);
      const itemName = item?.name ?? "Unknown Item";

      sourceOverrideResults.push({
        menuItemId: override.menuItemId,
        itemName,
        price: override.price,
      });

      const targetPrice = targetOverrideMap.get(override.menuItemId);
      if (targetPrice !== undefined) {
        conflicts.push({
          menuItemId: override.menuItemId,
          itemName,
          sourcePrice: override.price,
          targetPrice,
        });
      }
    }

    return {
      sourceOverrides: sourceOverrideResults,
      conflicts,
    };
  },
});

export const cloneMenu = mutation({
  args: {
    token: v.string(),
    sourceLocationId: v.id("locations"),
    targetLocationId: v.id("locations"),
    overwriteConflicts: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner"]);

    if (args.sourceLocationId === args.targetLocationId) {
      throw new Error("Source and target locations must be different");
    }

    // Validate both locations belong to tenant
    const sourceLocation = await ctx.db.get(args.sourceLocationId);
    if (!sourceLocation || sourceLocation.tenantId !== session.tenantId) {
      throw new Error("Source location not found");
    }

    const targetLocation = await ctx.db.get(args.targetLocationId);
    if (!targetLocation || targetLocation.tenantId !== session.tenantId) {
      throw new Error("Target location not found");
    }

    // Get all source overrides
    const sourceOverrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_location", (q) => q.eq("locationId", args.sourceLocationId))
      .collect();

    const filteredSourceOverrides = sourceOverrides.filter(
      (o) => o.tenantId === session.tenantId
    );

    // Get existing target overrides
    const targetOverrides = await ctx.db
      .query("locationPriceOverrides")
      .withIndex("by_location", (q) => q.eq("locationId", args.targetLocationId))
      .collect();

    const targetOverrideMap = new Map<string, { id: string; price: number }>();
    for (const o of targetOverrides) {
      if (o.tenantId === session.tenantId) {
        targetOverrideMap.set(o.menuItemId, { id: o._id, price: o.price });
      }
    }

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const override of filteredSourceOverrides) {
      const existing = targetOverrideMap.get(override.menuItemId);

      if (existing) {
        if (args.overwriteConflicts) {
          await ctx.db.patch(existing.id as typeof override._id, {
            price: override.price,
            updatedAt: now,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await ctx.db.insert("locationPriceOverrides", {
          menuItemId: override.menuItemId,
          locationId: args.targetLocationId,
          tenantId: session.tenantId,
          price: override.price,
          updatedAt: now,
        });
        created++;
      }
    }

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "menu_cloned",
      "locations",
      String(args.targetLocationId),
      {
        sourceLocationId: args.sourceLocationId,
        sourceLocationName: sourceLocation.name,
        targetLocationId: args.targetLocationId,
        targetLocationName: targetLocation.name,
        overwriteConflicts: args.overwriteConflicts,
        created,
        updated,
        skipped,
        totalSourceOverrides: filteredSourceOverrides.length,
      }
    );

    return { created, updated, skipped };
  },
});
