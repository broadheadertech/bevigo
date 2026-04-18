import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const FALLBACK_RECIPIENT = process.env.REPORT_DEFAULT_EMAIL;

function partsInTz(ts: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"), // "Mon", "Tue", ...
  };
}

function startOfDayInTz(ts: number, tz: string): number {
  const p = partsInTz(ts, tz);
  const wallNow = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  const offset = wallNow - ts;
  const wallMidnight = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  return wallMidnight - offset;
}

function endOfDayInTz(ts: number, tz: string): number {
  return startOfDayInTz(ts, tz) + 24 * 60 * 60 * 1000 - 1;
}

function formatRangeLabel(startMs: number, endMs: number, tz: string): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(startMs));
  const startTime = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startMs));
  const endTime = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(endMs));
  return `${date} · ${startTime}–${endTime}`;
}

function withinSameDayInTz(a: number, b: number, tz: string): boolean {
  const pa = partsInTz(a, tz);
  const pb = partsInTz(b, tz);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export const dispatchScheduledReports = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tenants = await ctx.runQuery(
      internal.reports.scheduled.listTenantsForReports,
      {}
    );

    let dispatched = 0;
    let skipped = 0;

    for (const t of tenants) {
      const recipient = t.reportEmail || FALLBACK_RECIPIENT;
      if (!recipient) {
        skipped++;
        continue;
      }
      const tz = t.timezone || "UTC";
      const here = partsInTz(now, tz);

      // ─── Partial (mid-day) ───
      if (t.sendPartialReport) {
        const [ph, pm] = (t.partialReportTime || "14:00").split(":").map(Number);
        if (here.hour === ph && here.minute < 60) {
          const alreadySent =
            t.lastPartialReportAt && withinSameDayInTz(t.lastPartialReportAt, now, tz);
          if (!alreadySent) {
            const startMs = startOfDayInTz(now, tz);
            const endMs = now;
            const label = formatRangeLabel(startMs, endMs, tz);
            try {
              await ctx.runAction(internal.reports.email.sendScheduledReport, {
                tenantId: t.tenantId,
                kind: "partial",
                startMs,
                endMs,
                rangeLabel: label,
                recipient,
              });
              dispatched++;
            } catch (err) {
              console.error(
                `Partial report failed for ${t.tenantName}:`,
                err instanceof Error ? err.message : err
              );
            }
          }
        }
      }

      // ─── End-of-day / weekly / monthly ───
      if (t.reportFrequency && t.reportFrequency !== "none") {
        const [dh, dm] = (t.dailyReportTime || "22:00").split(":").map(Number);
        if (here.hour === dh && here.minute < 60) {
          let shouldSend = false;
          if (t.reportFrequency === "daily") {
            shouldSend = true;
          } else if (t.reportFrequency === "weekly") {
            shouldSend = here.weekday === "Sun";
          } else if (t.reportFrequency === "monthly") {
            // Last day of month in tz: tomorrow's day < today's day
            const tomorrow = partsInTz(now + 24 * 60 * 60 * 1000, tz);
            shouldSend = tomorrow.day < here.day;
          }
          if (shouldSend) {
            const alreadySent =
              t.lastDailyReportAt && withinSameDayInTz(t.lastDailyReportAt, now, tz);
            if (!alreadySent) {
              const startMs = startOfDayInTz(now, tz);
              const endMs = endOfDayInTz(now, tz);
              const label = formatRangeLabel(startMs, endMs, tz);
              try {
                await ctx.runAction(internal.reports.email.sendScheduledReport, {
                  tenantId: t.tenantId,
                  kind: "daily",
                  startMs,
                  endMs,
                  rangeLabel: label,
                  recipient,
                });
                dispatched++;
              } catch (err) {
                console.error(
                  `Daily report failed for ${t.tenantName}:`,
                  err instanceof Error ? err.message : err
                );
              }
            }
          }
        }
      }
    }

    return { dispatched, skipped, checked: tenants.length };
  },
});
