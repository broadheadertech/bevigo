import { MutationCtx, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

export async function logAuditEntry(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  userId: Id<"users">,
  action: string,
  entityType: string,
  entityId: string,
  changes: Record<string, unknown>
) {
  await ctx.db.insert("auditLog", {
    tenantId,
    userId,
    action,
    entityType,
    entityId: String(entityId),
    changes,
  });
}

// Internal mutation callable from actions via ctx.runMutation
export const write = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    changes: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      userId: args.userId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      changes: args.changes,
    });
  },
});
