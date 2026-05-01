"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type LocationOption = {
  _id: Id<"locations">;
  name: string;
  status: string;
};

type Tab = "descriptive" | "diagnostic" | "predictive" | "prescriptive";

const TABS: Array<{ id: Tab; label: string; subtitle: string }> = [
  { id: "descriptive", label: "Descriptive", subtitle: "What happened" },
  { id: "diagnostic", label: "Diagnostic", subtitle: "Why it changed" },
  { id: "predictive", label: "Predictive", subtitle: "What's likely next" },
  { id: "prescriptive", label: "Prescriptive", subtitle: "What to do now" },
];

export default function InsightsPage() {
  const { token, session } = useAuth();
  const [tab, setTab] = useState<Tab>("descriptive");

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as LocationOption[] | undefined;

  const availableLocations = useMemo(() => {
    if (!locations || !session) return [];
    if (session.role === "owner") return locations;
    return locations.filter((l) => session.locationIds.includes(l._id));
  }, [locations, session]);

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const locationId = (selectedLocationId ||
    availableLocations[0]?._id ||
    "") as Id<"locations"> | "";

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
            Insights
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Four lenses on your shop — describe, diagnose, predict, prescribe.
          </p>
        </div>
        {availableLocations.length > 1 && (
          <select
            value={locationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors self-start md:self-auto"
            style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
          >
            {availableLocations.map((l) => (
              <option key={l._id} value={l._id}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 mb-6 rounded-2xl overflow-x-auto"
        style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}
        role="tablist"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className="flex-1 min-w-32 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.99]"
              style={{
                backgroundColor: active ? "var(--accent-color)" : "transparent",
                color: active ? "white" : "var(--fg)",
              }}
            >
              <div>{t.label}</div>
              <div
                className="text-[10px] font-normal mt-0.5"
                style={{
                  color: active ? "rgba(255,255,255,0.85)" : "var(--muted-fg)",
                }}
              >
                {t.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {!locationId ? (
        <Empty msg="Pick a location to see insights." />
      ) : tab === "descriptive" ? (
        <DescriptiveTab locationId={locationId} token={token} />
      ) : tab === "diagnostic" ? (
        <DiagnosticTab locationId={locationId} token={token} />
      ) : tab === "predictive" ? (
        <PredictiveTab locationId={locationId} token={token} />
      ) : (
        <PrescriptiveTab locationId={locationId} token={token} />
      )}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div
      className="rounded-3xl p-12 text-center"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)", color: "var(--muted-fg)" }}
    >
      {msg}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-3xl p-5"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-1"
        style={{ color: "var(--muted-fg)" }}
      >
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: "var(--fg)" }}>{value}</p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>{sub}</p>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl p-5"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
    >
      <h3
        className="text-[10px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--muted-fg)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtHour(h: number): string {
  return `${h}:00–${h + 1}:00`;
}

function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─────────────── DESCRIPTIVE TAB ───────────────

function DescriptiveTab({ token, locationId }: { token: string; locationId: Id<"locations"> }) {
  const data = useQuery(api.insights.getDescriptive, { token, locationId }) as
    | {
        dayCount: number;
        orderCount: number;
        grossTotal: number;
        netTotal: number;
        taxTotal: number;
        avgTicket: number;
        tender: { cash: number; card: number; ewallet: number };
        dailySeries: Array<{ day: number; revenue: number; orders: number }>;
        peakHour: number;
        peakHourOrders: number;
        topItems: Array<{ name: string; qty: number; revenue: number }>;
      }
    | undefined;

  if (!data) return <Empty msg="Crunching numbers…" />;

  const tenderTotal = data.tender.cash + data.tender.card + data.tender.ewallet;
  const tenderPct = (n: number) =>
    tenderTotal > 0 ? `${((n / tenderTotal) * 100).toFixed(0)}%` : "—";

  const maxRevenue = Math.max(...data.dailySeries.map((d) => d.revenue), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label={`Revenue (last ${data.dayCount}d)`} value={formatCurrency(data.grossTotal)} sub={`Net ${formatCurrency(data.netTotal)}`} />
        <Stat label="Orders" value={String(data.orderCount)} />
        <Stat label="Avg ticket" value={formatCurrency(data.avgTicket)} />
        <Stat label="Peak hour" value={fmtHour(data.peakHour)} sub={`${data.peakHourOrders} orders in window`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Daily revenue">
          <div className="space-y-2">
            {data.dailySeries.map((d) => (
              <div key={d.day} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0" style={{ color: "var(--muted-fg)" }}>
                  {fmtDay(d.day)}
                </span>
                <div
                  className="flex-1 h-5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--muted)" }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${(d.revenue / maxRevenue) * 100}%`,
                      backgroundColor: "var(--accent-color)",
                    }}
                  />
                </div>
                <span className="w-20 text-right font-mono" style={{ color: "var(--fg)" }}>
                  {formatCurrency(d.revenue)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Tender mix">
          <div className="space-y-3 text-sm">
            <Row label={`Cash (${tenderPct(data.tender.cash)})`} value={formatCurrency(data.tender.cash)} />
            <Row label={`Card (${tenderPct(data.tender.card)})`} value={formatCurrency(data.tender.card)} />
            <Row label={`E-Wallet (${tenderPct(data.tender.ewallet)})`} value={formatCurrency(data.tender.ewallet)} />
          </div>
        </Card>
      </div>

      <Card title="Top items by revenue">
        {data.topItems.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            No sales in this window.
          </p>
        ) : (
          <div className="space-y-2">
            {data.topItems.map((it) => (
              <div key={it.name} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--fg)" }}>
                  {it.name}{" "}
                  <span className="text-xs" style={{ color: "var(--muted-fg)" }}>× {it.qty}</span>
                </span>
                <span className="font-semibold" style={{ color: "var(--fg)" }}>
                  {formatCurrency(it.revenue)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────── DIAGNOSTIC TAB ───────────────

function DiagnosticTab({ token, locationId }: { token: string; locationId: Id<"locations"> }) {
  const data = useQuery(api.insights.getDiagnostic, { token, locationId }) as
    | {
        dayCount: number;
        currentRevenue: number;
        previousRevenue: number;
        revenueDelta: number;
        revenuePctChange: number | null;
        currentOrderCount: number;
        previousOrderCount: number;
        orderPctChange: number | null;
        gainers: Array<{ name: string; current: number; previous: number; delta: number }>;
        losers: Array<{ name: string; current: number; previous: number; delta: number }>;
        peakHourCurrent: number;
        peakHourPrevious: number;
        peakHourShifted: boolean;
      }
    | undefined;

  if (!data) return <Empty msg="Comparing against the prior period…" />;

  const trendColor = (n: number | null) =>
    n === null ? "var(--muted-fg)" : n >= 0 ? "#10b981" : "#ef4444";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat
          label={`Revenue vs prior ${data.dayCount}d`}
          value={fmtPct(data.revenuePctChange)}
          sub={`${formatCurrency(data.currentRevenue)} vs ${formatCurrency(data.previousRevenue)}`}
        />
        <Stat
          label="Orders vs prior period"
          value={fmtPct(data.orderPctChange)}
          sub={`${data.currentOrderCount} vs ${data.previousOrderCount}`}
        />
        <Stat
          label="Peak hour"
          value={fmtHour(data.peakHourCurrent)}
          sub={data.peakHourShifted ? `Shifted from ${fmtHour(data.peakHourPrevious)}` : "Stable"}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Top gainers">
          {data.gainers.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              No items grew vs the previous period.
            </p>
          ) : (
            <div className="space-y-2">
              {data.gainers.map((g) => (
                <div key={g.name} className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--fg)" }}>{g.name}</span>
                  <span className="font-semibold" style={{ color: "#10b981" }}>
                    +{formatCurrency(g.delta)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Top losers">
          {data.losers.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              No items declined.
            </p>
          ) : (
            <div className="space-y-2">
              {data.losers.map((g) => (
                <div key={g.name} className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--fg)" }}>{g.name}</span>
                  <span className="font-semibold" style={{ color: "#ef4444" }}>
                    {formatCurrency(g.delta)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Headline">
        <p className="text-sm" style={{ color: "var(--fg)" }}>
          Revenue is{" "}
          <strong style={{ color: trendColor(data.revenuePctChange) }}>
            {fmtPct(data.revenuePctChange)}
          </strong>{" "}
          vs the prior {data.dayCount} days, on{" "}
          <strong style={{ color: trendColor(data.orderPctChange) }}>
            {fmtPct(data.orderPctChange)}
          </strong>{" "}
          orders. {data.gainers[0] && (
            <>The biggest contributor is <strong>{data.gainers[0].name}</strong> (+{formatCurrency(data.gainers[0].delta)}). </>
          )}
          {data.losers[0] && (
            <>The biggest drag is <strong>{data.losers[0].name}</strong> ({formatCurrency(data.losers[0].delta)}).</>
          )}
        </p>
      </Card>
    </div>
  );
}

// ─────────────── PREDICTIVE TAB ───────────────

function PredictiveTab({ token, locationId }: { token: string; locationId: Id<"locations"> }) {
  const data = useQuery(api.insights.getPredictive, { token, locationId }) as
    | {
        historyDays: number;
        forecastDays: number;
        historicalAvgDailyRevenue: number;
        forecastTotal: number;
        projection: Array<{ day: number; forecast: number }>;
        depletions: Array<{
          name: string;
          unit: string;
          onHand: number;
          dailyUsage: number;
          daysLeft: number;
          reorderThreshold: number;
        }>;
      }
    | undefined;

  if (!data) return <Empty msg="Forecasting…" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat
          label="Avg daily revenue"
          value={formatCurrency(data.historicalAvgDailyRevenue)}
          sub={`Based on last ${data.historyDays} days`}
        />
        <Stat
          label={`Forecast next ${data.forecastDays}d`}
          value={formatCurrency(data.forecastTotal)}
          sub="7-day moving average"
        />
        <Stat
          label="At-risk ingredients"
          value={String(data.depletions.filter((d) => d.daysLeft <= 7).length)}
          sub="≤7 days of stock"
        />
      </div>

      <Card title="Daily revenue forecast">
        <div className="space-y-2">
          {data.projection.map((p) => (
            <div key={p.day} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--muted-fg)" }}>{fmtDay(p.day)}</span>
              <span className="font-semibold font-mono" style={{ color: "var(--fg)" }}>
                {formatCurrency(p.forecast)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Ingredient depletion forecast">
        {data.depletions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            No ingredients are being consumed yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--muted-fg)" }} className="text-[10px] uppercase tracking-widest">
                <th className="text-left py-2">Ingredient</th>
                <th className="text-right py-2">On hand</th>
                <th className="text-right py-2">Use/day</th>
                <th className="text-right py-2">Days left</th>
              </tr>
            </thead>
            <tbody>
              {data.depletions.map((d) => {
                const urgent = d.daysLeft <= 3 || d.onHand < d.reorderThreshold;
                const soon = !urgent && d.daysLeft <= 7;
                const color = urgent ? "#ef4444" : soon ? "#f59e0b" : "var(--fg)";
                return (
                  <tr key={d.name} style={{ borderTop: "1px solid var(--border-color)" }}>
                    <td className="py-2" style={{ color: "var(--fg)" }}>{d.name}</td>
                    <td className="py-2 text-right font-mono">{d.onHand.toFixed(1)}{d.unit}</td>
                    <td className="py-2 text-right font-mono">{d.dailyUsage.toFixed(1)}{d.unit}</td>
                    <td className="py-2 text-right font-mono font-semibold" style={{ color }}>
                      {Number.isFinite(d.daysLeft) ? d.daysLeft.toFixed(1) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─────────────── PRESCRIPTIVE TAB ───────────────

function PrescriptiveTab({ token, locationId }: { token: string; locationId: Id<"locations"> }) {
  const data = useQuery(api.insights.getPrescriptive, { token, locationId }) as
    | {
        actions: Array<{
          kind: string;
          severity: "high" | "medium" | "low";
          title: string;
          detail: string;
        }>;
      }
    | undefined;

  if (!data) return <Empty msg="Generating recommendations…" />;

  if (data.actions.length === 0) {
    return <Empty msg="Nothing to act on right now — keep it up." />;
  }

  return (
    <div className="space-y-3">
      {data.actions.map((a, i) => {
        const sevColor =
          a.severity === "high" ? "#ef4444" : a.severity === "medium" ? "#f59e0b" : "#10b981";
        const sevLabel = a.severity === "high" ? "Now" : a.severity === "medium" ? "Soon" : "FYI";
        return (
          <div
            key={i}
            className="rounded-3xl p-4 flex gap-4 items-start"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border-color)",
              borderLeft: `4px solid ${sevColor}`,
            }}
          >
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{ backgroundColor: sevColor, color: "white" }}
            >
              {sevLabel}
            </span>
            <div className="flex-1">
              <div className="font-semibold" style={{ color: "var(--fg)" }}>{a.title}</div>
              <div className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>{a.detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--muted-fg)" }}>{label}</span>
      <span className="font-medium" style={{ color: "var(--fg)" }}>{value}</span>
    </div>
  );
}
