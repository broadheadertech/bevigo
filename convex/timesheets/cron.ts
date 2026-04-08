import { internalMutation } from "../_generated/server";
import { computeTimesheetTotals } from "./mutations";

export const autoClockOutInactive = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all tenant settings to know per-tenant thresholds
    const allSettings = await ctx.db.query("tenantSettings").collect();
    const tenantThresholdMs = new Map<string, number>();
    for (const s of allSettings) {
      const hours = s.autoClockOutHours ?? 12;
      tenantThresholdMs.set(s.tenantId, hours * 3600000);
    }
    const defaultThresholdMs = 12 * 3600000;

    let closedCount = 0;

    const allRows = await ctx.db.query("timesheets").collect();
    const matching = allRows.filter(
      (r) => r.status === "active" || r.status === "on_break"
    );

    {
      for (const ts of matching) {
        const threshold = tenantThresholdMs.get(ts.tenantId) ?? defaultThresholdMs;
        if (now - ts.clockInAt <= threshold) continue;

        // End any active break
        const breaks = await ctx.db
          .query("timesheetBreaks")
          .withIndex("by_timesheet", (q) => q.eq("timesheetId", ts._id))
          .collect();
        for (const b of breaks) {
          if (!b.endedAt) {
            const dur = Math.max(0, Math.round((now - b.startedAt) / 60000));
            await ctx.db.patch(b._id, { endedAt: now, durationMinutes: dur });
          }
        }

        const fresh = await ctx.db.get(ts._id);
        if (!fresh) continue;
        const totals = await computeTimesheetTotals(ctx, fresh, now);

        await ctx.db.patch(ts._id, {
          clockOutAt: now,
          workMinutes: totals.workMinutes,
          breakMinutes: totals.breakMinutes,
          overtimeMinutes: totals.overtimeMinutes,
          overtimeAmount: totals.overtimeAmount,
          hourlyRate: totals.hourlyRate,
          earnedAmount: totals.earnedAmount,
          status: "auto_closed",
          updatedAt: now,
        });
        closedCount += 1;
      }
    }

    return { closedCount };
  },
});
