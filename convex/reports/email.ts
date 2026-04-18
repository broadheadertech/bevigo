"use node";

import { internalAction, action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { Resend } from "resend";
import { Id } from "../_generated/dataModel";

type Snapshot = Awaited<
  ReturnType<typeof internal.reports.scheduled.buildSnapshot>
> extends infer R
  ? R
  : never;

const FROM_EMAIL = process.env.REPORT_FROM_EMAIL ?? "noreply@bevigo.co";
const FALLBACK_RECIPIENT = process.env.REPORT_DEFAULT_EMAIL;

function formatCurrency(cents: number, currency: string = "PHP"): string {
  const config: Record<string, { locale: string; currency: string }> = {
    PHP: { locale: "en-PH", currency: "PHP" },
    USD: { locale: "en-US", currency: "USD" },
    SGD: { locale: "en-SG", currency: "SGD" },
    MYR: { locale: "ms-MY", currency: "MYR" },
    THB: { locale: "th-TH", currency: "THB" },
    IDR: { locale: "id-ID", currency: "IDR" },
  };
  const c = config[currency] ?? config.PHP;
  const divisor = currency === "IDR" ? 1 : 100;
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.currency,
    minimumFractionDigits: currency === "IDR" ? 0 : 2,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(cents / divisor);
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDateTime(ts: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function formatTime(ts: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function paymentLabel(t: string): string {
  switch (t) {
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    case "ewallet":
      return "E-Wallet";
    default:
      return t;
  }
}

function row(label: string, value: string, bold = false): string {
  return `<tr>
    <td style="padding:6px 0;color:#555;font-size:13px;">${label}</td>
    <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:13px;${
      bold ? "font-weight:700;" : ""
    }">${value}</td>
  </tr>`;
}

function buildHtml(snapshot: Snapshot, kind: "partial" | "daily"): string {
  const c = snapshot.currency;
  const tz = snapshot.tenantTimezone;
  const title = kind === "partial" ? "Mid-Day Report" : "End-of-Day Report";

  const paymentRows =
    snapshot.paymentBreakdown.length > 0
      ? snapshot.paymentBreakdown
          .map(
            (p) =>
              `<tr>
                <td style="padding:6px 0;font-size:13px;">${paymentLabel(p.type)} <span style="color:#888;">(${p.count})</span></td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:13px;">${formatCurrency(p.amount, c)}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="2" style="padding:8px 0;color:#888;font-size:13px;">No payments yet</td></tr>`;

  const topItemsRows =
    snapshot.topItems.length > 0
      ? snapshot.topItems
          .map(
            (it) =>
              `<tr>
                <td style="padding:6px 0;font-size:13px;">${it.name} <span style="color:#888;">×${it.quantity}</span></td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:13px;">${formatCurrency(it.revenue, c)}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="2" style="padding:8px 0;color:#888;font-size:13px;">No items sold yet</td></tr>`;

  const onDutyRows =
    snapshot.staffOnDuty.length > 0
      ? snapshot.staffOnDuty
          .map(
            (s) =>
              `<tr>
                <td style="padding:6px 0;font-size:13px;">${s.userName}</td>
                <td style="padding:6px 0;font-size:12px;color:#666;">${s.locationName}</td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:13px;">${formatHours(s.minutesSoFar)}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="padding:8px 0;color:#888;font-size:13px;">No one on duty right now</td></tr>`;

  const staffHoursRows =
    snapshot.staffHours.length > 0
      ? snapshot.staffHours
          .map(
            (s) =>
              `<tr>
                <td style="padding:6px 0;font-size:13px;">${s.userName}</td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:13px;">${formatHours(s.workMinutes)}${s.overtimeMinutes > 0 ? ` <span style="color:#d97706;">+${formatHours(s.overtimeMinutes)} OT</span>` : ""}</td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:13px;">${formatCurrency(s.earnedAmount, c)}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="padding:8px 0;color:#888;font-size:13px;">No completed shifts in range</td></tr>`;

  const shiftsRows =
    snapshot.shifts.length > 0
      ? snapshot.shifts
          .map(
            (s) =>
              `<tr>
                <td style="padding:6px 0;font-size:13px;">${s.userName} <span style="color:#888;">@ ${s.locationName}</span></td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:12px;color:#666;">${formatTime(s.startedAt, tz)}–${s.endedAt ? formatTime(s.endedAt, tz) : "now"}</td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:13px;${s.variance !== null && s.variance !== 0 ? (s.variance < 0 ? "color:#dc2626;" : "color:#059669;") : ""}">${
                  s.variance === null
                    ? "—"
                    : (s.variance >= 0 ? "+" : "") + formatCurrency(s.variance, c)
                }</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="padding:8px 0;color:#888;font-size:13px;">No shifts in range</td></tr>`;

  const lowStockRows =
    snapshot.lowStock.length > 0
      ? snapshot.lowStock
          .slice(0, 15)
          .map(
            (l) =>
              `<tr>
                <td style="padding:6px 0;font-size:13px;">${l.name} <span style="color:#888;">@ ${l.locationName}</span></td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:13px;color:#dc2626;">${l.quantity} ${l.unit}</td>
                <td style="padding:6px 0;text-align:right;font-family:'Courier New',monospace;font-size:12px;color:#888;">/ ${l.threshold} ${l.unit}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="padding:8px 0;color:#059669;font-size:13px;">All stock above thresholds ✓</td></tr>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e7e5e4;">
      <tr><td>
        <p style="margin:0 0 4px;color:#888;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">${snapshot.tenantName}</p>
        <h1 style="margin:0;font-size:22px;color:#1c1917;">${title}</h1>
        <p style="margin:6px 0 24px;color:#666;font-size:14px;">${snapshot.rangeLabel}</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1c1917;color:#ffffff;border-radius:12px;padding:18px;margin-bottom:24px;">
          <tr>
            <td style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;">Net Sales</td>
            <td align="right" style="font-size:24px;font-weight:700;font-family:'Courier New',monospace;">${formatCurrency(snapshot.totals.netSales, c)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:8px;font-size:12px;opacity:0.7;">${snapshot.totals.orderCount} orders &middot; avg ${formatCurrency(snapshot.totals.avgOrderValue, c)}</td>
          </tr>
        </table>

        <h2 style="margin:24px 0 8px;font-size:13px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">Totals</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row("Gross sales", formatCurrency(snapshot.totals.grossSales, c))}
          ${row("Tax collected", formatCurrency(snapshot.totals.taxCollected, c))}
          ${row("Discounts applied", `− ${formatCurrency(snapshot.totals.discountTotal, c)}`)}
          ${row("Refunds", `− ${formatCurrency(snapshot.totals.refundTotal, c)}`)}
          ${row("Net sales", formatCurrency(snapshot.totals.netSales, c), true)}
        </table>

        <h2 style="margin:24px 0 8px;font-size:13px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">Payments</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${paymentRows}
        </table>

        <h2 style="margin:24px 0 8px;font-size:13px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">Top Items</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${topItemsRows}
        </table>

        ${
          kind === "partial"
            ? `<h2 style="margin:24px 0 8px;font-size:13px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">Currently On Duty</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${onDutyRows}
        </table>`
            : `<h2 style="margin:24px 0 8px;font-size:13px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">Staff Hours</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${staffHoursRows}
        </table>

        <h2 style="margin:24px 0 8px;font-size:13px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">Shifts (cash variance)</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${shiftsRows}
        </table>`
        }

        <h2 style="margin:24px 0 8px;font-size:13px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">Low Stock</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${lowStockRows}
        </table>

        ${
          snapshot.voids.count > 0
            ? `<p style="margin:24px 0 0;font-size:12px;color:#dc2626;">${snapshot.voids.count} voided order${snapshot.voids.count === 1 ? "" : "s"} (${formatCurrency(snapshot.voids.total, c)})</p>`
            : ""
        }

        <p style="margin:32px 0 0;font-size:11px;color:#a8a29e;text-align:center;">
          Generated by bevi&amp;go &middot; ${formatDateTime(Date.now(), tz)}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildText(snapshot: Snapshot, kind: "partial" | "daily"): string {
  const c = snapshot.currency;
  const lines: string[] = [];
  lines.push(`${snapshot.tenantName} — ${kind === "partial" ? "Mid-Day" : "End-of-Day"} Report`);
  lines.push(snapshot.rangeLabel);
  lines.push("");
  lines.push(`Net sales: ${formatCurrency(snapshot.totals.netSales, c)} (${snapshot.totals.orderCount} orders)`);
  lines.push(`Gross: ${formatCurrency(snapshot.totals.grossSales, c)} | Tax: ${formatCurrency(snapshot.totals.taxCollected, c)} | Discounts: ${formatCurrency(snapshot.totals.discountTotal, c)} | Refunds: ${formatCurrency(snapshot.totals.refundTotal, c)}`);
  lines.push("");
  if (snapshot.paymentBreakdown.length > 0) {
    lines.push("Payments:");
    for (const p of snapshot.paymentBreakdown) {
      lines.push(`  ${paymentLabel(p.type)} (${p.count}): ${formatCurrency(p.amount, c)}`);
    }
    lines.push("");
  }
  if (snapshot.topItems.length > 0) {
    lines.push("Top items:");
    for (const it of snapshot.topItems) {
      lines.push(`  ${it.name} ×${it.quantity}: ${formatCurrency(it.revenue, c)}`);
    }
    lines.push("");
  }
  if (snapshot.lowStock.length > 0) {
    lines.push(`Low stock (${snapshot.lowStock.length} items):`);
    for (const l of snapshot.lowStock.slice(0, 10)) {
      lines.push(`  ${l.name} @ ${l.locationName}: ${l.quantity}/${l.threshold} ${l.unit}`);
    }
  }
  return lines.join("\n");
}

async function sendReport(opts: {
  tenantId: Id<"tenants">;
  recipient: string;
  snapshot: Snapshot;
  kind: "partial" | "daily";
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY env var is not set");

  const resend = new Resend(apiKey);
  const subject = `${opts.snapshot.tenantName}: ${opts.kind === "partial" ? "Mid-day" : "End-of-day"} report — ${opts.snapshot.rangeLabel}`;
  const html = buildHtml(opts.snapshot, opts.kind);
  const text = buildText(opts.snapshot, opts.kind);

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: opts.recipient,
    subject,
    html,
    text,
  });

  if (result.error) {
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }
  return result.data?.id;
}

export const sendScheduledReport = internalAction({
  args: {
    tenantId: v.id("tenants"),
    kind: v.union(v.literal("partial"), v.literal("daily")),
    startMs: v.number(),
    endMs: v.number(),
    rangeLabel: v.string(),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    const snapshot = await ctx.runQuery(internal.reports.scheduled.buildSnapshot, {
      tenantId: args.tenantId,
      startMs: args.startMs,
      endMs: args.endMs,
      rangeLabel: args.rangeLabel,
    });

    const id = await sendReport({
      tenantId: args.tenantId,
      recipient: args.recipient,
      snapshot,
      kind: args.kind,
    });

    await ctx.runMutation(internal.reports.scheduled.markReportSent, {
      tenantId: args.tenantId,
      kind: args.kind,
      sentAt: Date.now(),
    });

    return { messageId: id };
  },
});

export const sendTestReport = action({
  args: {
    token: v.string(),
    kind: v.union(v.literal("partial"), v.literal("daily")),
  },
  handler: async (ctx, args): Promise<{ messageId: string | undefined; recipient: string }> => {
    const auth = await ctx.runQuery(
      internal.reports.scheduledHelpers.authenticateOwner,
      { token: args.token }
    );

    const settings = await ctx.runQuery(
      internal.reports.scheduledHelpers.getTenantReportConfig,
      { tenantId: auth.tenantId }
    );
    const recipient = settings?.reportEmail || FALLBACK_RECIPIENT;
    if (!recipient) {
      throw new ConvexError(
        "No recipient email configured. Set one in Settings → Reports."
      );
    }

    const tz = settings?.timezone ?? "UTC";
    const now = Date.now();
    const todayStart = startOfDayInTz(now, tz);
    const endMs = args.kind === "partial" ? now : endOfDayInTz(now, tz);
    const rangeLabel = formatRangeLabel(todayStart, endMs, tz);

    const snapshot = await ctx.runQuery(internal.reports.scheduled.buildSnapshot, {
      tenantId: auth.tenantId,
      startMs: todayStart,
      endMs,
      rangeLabel,
    });

    const id = await sendReport({
      tenantId: auth.tenantId,
      recipient,
      snapshot,
      kind: args.kind,
    });

    return { messageId: id, recipient };
  },
});

function startOfDayInTz(ts: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  const h = get("hour");
  const mi = get("minute");
  const s = get("second");
  // The wall-clock at start of day in tz is y-mo-d 00:00:00.
  // Compute its ms: take the offset between (y,mo,d,h,mi,s) wall and ts.
  const wallNow = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = wallNow - ts;
  const wallMidnight = Date.UTC(y, mo - 1, d, 0, 0, 0);
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
