import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { Doc } from "../_generated/dataModel";

export const listAuditLog = query({
  args: {
    token: v.string(),
    limit: v.optional(v.number()),
    entityType: v.optional(v.string()),
    action: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const rawLimit = args.limit ?? 50;
    const limit = Math.min(Math.max(rawLimit, 1), 200);

    // Query all audit log entries for this tenant, newest first
    let entries: Doc<"auditLog">[];

    if (args.entityType) {
      entries = await ctx.db
        .query("auditLog")
        .withIndex("by_tenant_entity", (q) =>
          q.eq("tenantId", session.tenantId).eq("entityType", args.entityType!)
        )
        .order("desc")
        .collect();
    } else {
      entries = await ctx.db
        .query("auditLog")
        .withIndex("by_tenant_date", (q) =>
          q.eq("tenantId", session.tenantId)
        )
        .order("desc")
        .collect();
    }

    // Apply action filter
    if (args.action) {
      const actionLower = args.action.toLowerCase();
      entries = entries.filter((entry: Doc<"auditLog">) =>
        entry.action.toLowerCase().includes(actionLower)
      );
    }

    // Apply date range filters
    if (args.startDate) {
      entries = entries.filter(
        (entry: Doc<"auditLog">) => entry._creationTime >= args.startDate!
      );
    }
    if (args.endDate) {
      entries = entries.filter(
        (entry: Doc<"auditLog">) => entry._creationTime <= args.endDate!
      );
    }

    // Limit results
    entries = entries.slice(0, limit);

    // Resolve user names
    const userIds = [...new Set(entries.map((e: Doc<"auditLog">) => e.userId))];
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get(id))
    );
    const userMap = new Map(
      users
        .filter((u): u is Doc<"users"> => u !== null)
        .map((u: Doc<"users">) => [u._id.toString(), u.name])
    );

    return entries.map((entry: Doc<"auditLog">) => ({
      _id: entry._id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes,
      userName: userMap.get(entry.userId.toString()) ?? "Unknown",
      timestamp: entry._creationTime,
    }));
  },
});
