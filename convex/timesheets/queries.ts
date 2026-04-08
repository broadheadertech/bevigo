import { query } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth, requireRole } from "../lib/auth";
import { Doc, Id } from "../_generated/dataModel";

export const getActiveTimesheet = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    let active = await ctx.db
      .query("timesheets")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", session.userId).eq("status", "active")
      )
      .first();

    if (!active) {
      active = await ctx.db
        .query("timesheets")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", session.userId).eq("status", "on_break")
        )
        .first();
    }

    if (!active) return null;

    const location = await ctx.db.get(active.locationId);

    // Find current active break (if any)
    let activeBreakStartedAt: number | undefined;
    if (active.status === "on_break") {
      const breaks = await ctx.db
        .query("timesheetBreaks")
        .withIndex("by_timesheet", (q) => q.eq("timesheetId", active!._id))
        .collect();
      const open = breaks.find((b) => !b.endedAt);
      activeBreakStartedAt = open?.startedAt;
    }

    return {
      _id: active._id,
      clockInAt: active.clockInAt,
      locationId: active.locationId,
      locationName: location?.name ?? "Unknown",
      status: active.status,
      activeBreakStartedAt,
    };
  },
});

export const listBreaks = query({
  args: {
    token: v.string(),
    timesheetId: v.id("timesheets"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet || timesheet.tenantId !== session.tenantId) {
      throw new ConvexError("Timesheet not found");
    }
    const isOwnerOrManager =
      session.role === "owner" || session.role === "manager";
    if (timesheet.userId !== session.userId && !isOwnerOrManager) {
      throw new ConvexError("Not authorized");
    }
    const breaks = await ctx.db
      .query("timesheetBreaks")
      .withIndex("by_timesheet", (q) => q.eq("timesheetId", args.timesheetId))
      .collect();
    return breaks
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((b) => ({
        _id: b._id,
        startedAt: b.startedAt,
        endedAt: b.endedAt,
        durationMinutes: b.durationMinutes,
        type: b.type,
      }));
  },
});

export const listEditHistory = query({
  args: {
    token: v.string(),
    timesheetId: v.id("timesheets"),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet || timesheet.tenantId !== session.tenantId) {
      throw new ConvexError("Timesheet not found");
    }

    const edits = await ctx.db
      .query("timesheetEdits")
      .withIndex("by_timesheet", (q) => q.eq("timesheetId", args.timesheetId))
      .collect();

    const userCache = new Map<string, Doc<"users"> | null>();
    const enriched = await Promise.all(
      edits
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (e) => {
          let user = userCache.get(e.editedBy);
          if (user === undefined) {
            user = await ctx.db.get(e.editedBy);
            userCache.set(e.editedBy, user);
          }
          return {
            _id: e._id,
            field: e.field,
            oldValue: e.oldValue,
            newValue: e.newValue,
            reason: e.reason,
            createdAt: e.createdAt,
            editedBy: e.editedBy,
            editedByName: user?.name ?? "Unknown",
          };
        })
    );

    return enriched;
  },
});

export const listTimesheets = query({
  args: {
    token: v.string(),
    userId: v.optional(v.id("users")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    locationId: v.optional(v.id("locations")),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("on_break"),
        v.literal("completed"),
        v.literal("auto_closed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);

    const isOwnerOrManager =
      session.role === "owner" || session.role === "manager";

    // Baristas may only view their own
    if (!isOwnerOrManager && args.userId && args.userId !== session.userId) {
      throw new ConvexError("Not authorized to view other timesheets");
    }

    const filterUserId: Id<"users"> | undefined = isOwnerOrManager
      ? args.userId
      : session.userId;

    let rows: Doc<"timesheets">[];
    if (filterUserId) {
      rows = await ctx.db
        .query("timesheets")
        .withIndex("by_user", (q) => q.eq("userId", filterUserId))
        .order("desc")
        .take(500);
      rows = rows.filter((r) => r.tenantId === session.tenantId);
    } else {
      rows = await ctx.db
        .query("timesheets")
        .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
        .order("desc")
        .take(500);
    }

    rows = rows.filter((r) => {
      if (args.locationId && r.locationId !== args.locationId) return false;
      if (args.status && r.status !== args.status) return false;
      if (args.startDate !== undefined && r.clockInAt < args.startDate)
        return false;
      if (args.endDate !== undefined && r.clockInAt > args.endDate) return false;
      return true;
    });

    // Resolve user/location names
    const userCache = new Map<string, Doc<"users"> | null>();
    const locCache = new Map<string, Doc<"locations"> | null>();

    const enriched = await Promise.all(
      rows.map(async (t) => {
        let user = userCache.get(t.userId);
        if (user === undefined) {
          user = await ctx.db.get(t.userId);
          userCache.set(t.userId, user);
        }
        let loc = locCache.get(t.locationId);
        if (loc === undefined) {
          loc = await ctx.db.get(t.locationId);
          locCache.set(t.locationId, loc);
        }

        return {
          _id: t._id,
          userId: t.userId,
          userName: user?.name ?? "Unknown",
          locationId: t.locationId,
          locationName: loc?.name ?? "Unknown",
          clockInAt: t.clockInAt,
          clockOutAt: t.clockOutAt,
          workMinutes: t.workMinutes,
          breakMinutes: t.breakMinutes,
          overtimeMinutes: t.overtimeMinutes,
          overtimeAmount: t.overtimeAmount,
          hourlyRate: t.hourlyRate,
          earnedAmount: t.earnedAmount,
          status: t.status,
          approvedBy: t.approvedBy,
          approvedAt: t.approvedAt,
          notes: t.notes,
          editedBy: t.editedBy,
          editedAt: t.editedAt,
          editReason: t.editReason,
          clockInPhotoId: t.clockInPhotoId,
          clockOutPhotoId: t.clockOutPhotoId,
          clockInFaceMatch: t.clockInFaceMatch,
          clockOutFaceMatch: t.clockOutFaceMatch,
          photoFlagged: t.photoFlagged,
        };
      })
    );

    return enriched;
  },
});

export const payrollSummary = query({
  args: {
    token: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const session = await requireAuth(ctx, args.token);
    requireRole(session, ["owner", "manager"]);

    const rows = await ctx.db
      .query("timesheets")
      .withIndex("by_tenant", (q) => q.eq("tenantId", session.tenantId))
      .order("desc")
      .take(2000);

    const filtered = rows.filter((r) => {
      if (r.status !== "completed") return false;
      if (args.locationId && r.locationId !== args.locationId) return false;
      if (r.clockInAt < args.startDate || r.clockInAt > args.endDate)
        return false;
      return true;
    });

    const grouped = new Map<
      string,
      {
        userId: Id<"users">;
        userName: string;
        totalMinutes: number;
        totalHours: number;
        totalEarned: number;
        timesheetCount: number;
      }
    >();

    for (const t of filtered) {
      const key = t.userId;
      let entry = grouped.get(key);
      if (!entry) {
        const user = await ctx.db.get(t.userId);
        entry = {
          userId: t.userId,
          userName: user?.name ?? "Unknown",
          totalMinutes: 0,
          totalHours: 0,
          totalEarned: 0,
          timesheetCount: 0,
        };
        grouped.set(key, entry);
      }
      entry.totalMinutes += t.workMinutes ?? 0;
      entry.totalEarned += t.earnedAmount ?? 0;
      entry.timesheetCount += 1;
    }

    for (const entry of grouped.values()) {
      entry.totalHours = Math.round((entry.totalMinutes / 60) * 100) / 100;
    }

    return Array.from(grouped.values());
  },
});
