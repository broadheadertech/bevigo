import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { logAuditEntry } from "../audit/helpers";

export const cloneLocationConfig = mutation({
  args: {
    token: v.string(),
    sourceLocationId: v.id("locations"),
    targetLocationId: v.id("locations"),
    cloneOptions: v.object({
      taxConfig: v.boolean(),
      operatingHours: v.boolean(),
      currency: v.boolean(),
    }),
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

    const { cloneOptions } = args;
    const patch: Record<string, unknown> = {};
    const clonedFields: string[] = [];

    if (cloneOptions.taxConfig) {
      patch.taxRate = sourceLocation.taxRate;
      patch.taxLabel = sourceLocation.taxLabel;
      clonedFields.push("taxConfig");
    }

    if (cloneOptions.operatingHours) {
      patch.operatingHours = sourceLocation.operatingHours;
      clonedFields.push("operatingHours");
    }

    if (cloneOptions.currency) {
      patch.currency = sourceLocation.currency;
      patch.timezone = sourceLocation.timezone;
      clonedFields.push("currency", "timezone");
    }

    if (clonedFields.length === 0) {
      throw new Error("No options selected for cloning");
    }

    patch.updatedAt = Date.now();
    await ctx.db.patch(args.targetLocationId, patch);

    await logAuditEntry(
      ctx,
      session.tenantId,
      session.userId,
      "location_config_cloned",
      "locations",
      String(args.targetLocationId),
      {
        sourceLocationId: args.sourceLocationId,
        sourceLocationName: sourceLocation.name,
        targetLocationId: args.targetLocationId,
        targetLocationName: targetLocation.name,
        cloneOptions,
        clonedFields,
      }
    );

    return { clonedFields };
  },
});
