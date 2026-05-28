"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../../convex/_generated/dataModel";
import { Pagination, usePagination } from "@/components/ui/pagination";

type Row = {
  dayStart: number;
  ingredientId: Id<"ingredients">;
  name: string;
  unit: string;
  category: string | null;
  openingQuantity: number;
  consumed: number;
  received: number;
  adjusted: number;
  closingQuantity: number;
  calculated: number;
  variance: number;
  isLive: boolean;
};

type LocationOpt = {
  _id: Id<"locations">;
  name: string;
  status: string;
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateInputToTs(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtQty(n: number, unit: string): string {
  return `${n.toFixed(1)}${unit}`;
}

export default function AuditTrailPage() {
  const { token, session } = useAuth();
  const [startDateStr, setStartDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [endDateStr, setEndDateStr] = useState(todayStr());
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [capturedMsg, setCapturedMsg] = useState<string | null>(null);

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as LocationOpt[] | undefined;

  const availableLocations = useMemo(() => {
    if (!locations || !session) return [];
    if (session.role === "owner") return locations;
    return locations.filter((l) => session.locationIds.includes(l._id));
  }, [locations, session]);

  const locationId =
    (selectedLocationId || availableLocations[0]?._id) as
      | Id<"locations">
      | undefined;

  const audit = useQuery(
    api.inventory.auditTrail.getAuditTrail,
    token && locationId
      ? {
          token,
          locationId,
          startDate: dateInputToTs(startDateStr),
          endDate: dateInputToTs(endDateStr),
        }
      : "skip"
  ) as { locationName: string; rows: Row[] } | undefined;

  const captureNow = useMutation(api.inventory.auditTrail.captureSnapshotNow);

  const trimmedSearch = search.trim().toLowerCase();
  const filteredRows = (audit?.rows ?? []).filter((r) => {
    if (!trimmedSearch) return true;
    return (
      r.name.toLowerCase().includes(trimmedSearch) ||
      (r.category ?? "").toLowerCase().includes(trimmedSearch)
    );
  });

  const { paginatedItems, currentPage, totalPages, setCurrentPage } =
    usePagination(filteredRows, 25);

  if (!session || (session.role !== "owner" && session.role !== "manager")) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--muted-fg)" }}>
        Owner/manager only.
      </div>
    );
  }

  const handleCapture = async () => {
    if (!token || !locationId) return;
    setCapturing(true);
    setCapturedMsg(null);
    try {
      const r = await captureNow({
        token,
        locationId,
        date: dateInputToTs(endDateStr),
      });
      setCapturedMsg(
        `Captured ${r.count} ingredient${r.count === 1 ? "" : "s"} for ${fmtDay(r.dayStart)}.`
      );
      setTimeout(() => setCapturedMsg(null), 4000);
    } catch (e) {
      setCapturedMsg(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setCapturing(false);
    }
  };

  const exportCsv = () => {
    if (!audit) return;
    const headers = [
      "Date",
      "Ingredient",
      "Category",
      "Unit",
      "Opening (BOD)",
      "Received",
      "Consumed",
      "Adjusted",
      "Closing (EOD)",
      "Calculated",
      "Variance",
      "Live?",
    ];
    const escape = (v: string | number) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(escape).join(",")];
    for (const r of filteredRows) {
      lines.push(
        [
          new Date(r.dayStart).toLocaleDateString(),
          r.name,
          r.category ?? "",
          r.unit,
          r.openingQuantity.toFixed(2),
          r.received.toFixed(2),
          r.consumed.toFixed(2),
          r.adjusted.toFixed(2),
          r.closingQuantity.toFixed(2),
          r.calculated.toFixed(2),
          r.variance.toFixed(2),
          r.isLive ? "live" : "snapshot",
        ]
          .map(escape)
          .join(",")
      );
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-audit-${startDateStr}_to_${endDateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
          Inventory Audit Trail
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
          Per-ingredient Beginning-of-Day and End-of-Day balances for every day
          in the selected range. Nightly snapshot runs at 00:10 Manila time;
          today&apos;s row is live (computed from the current stock).
        </p>
      </div>

      <div
        className="rounded-2xl shadow p-4 mb-5"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-fg)" }}>
              From
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-fg)" }}>
              To
            </label>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-fg)" }}>
              Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            >
              {availableLocations.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-50">
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-fg)" }}>
              Filter
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ingredient or category…"
              className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            />
          </div>
          <button
            onClick={handleCapture}
            disabled={capturing || !locationId}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            title="Force a snapshot capture for the End date"
          >
            {capturing ? "Capturing…" : "Snapshot now"}
          </button>
          <button
            onClick={exportCsv}
            disabled={!audit || filteredRows.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-color)", color: "white" }}
          >
            Export CSV
          </button>
        </div>
        {capturedMsg && (
          <p className="mt-3 text-xs" style={{ color: "var(--accent-color)" }}>
            {capturedMsg}
          </p>
        )}
      </div>

      {!audit ? (
        <div
          className="rounded-2xl p-12 text-center text-sm"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
            color: "var(--muted-fg)",
          }}
        >
          Loading…
        </div>
      ) : filteredRows.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center text-sm"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
            color: "var(--muted-fg)",
          }}
        >
          {trimmedSearch
            ? `No ingredients match "${search.trim()}".`
            : "No snapshots in this date range yet. Click Snapshot now to capture today, or wait for the nightly job."}
        </div>
      ) : (
        <div
          className="rounded-2xl shadow-lg overflow-hidden overflow-x-auto"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <table className="w-full text-xs min-w-160">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted-fg)" }}>Date</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Ingredient</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>BOD</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Received</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Consumed</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Adjusted</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>EOD</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((r, i) => {
                const varAbs = Math.abs(r.variance);
                const varColor =
                  varAbs < 0.01
                    ? "var(--muted-fg)"
                    : varAbs < 1
                      ? "#f59e0b"
                      : "#ef4444";
                return (
                  <tr
                    key={`${r.dayStart}-${r.ingredientId}-${i}`}
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted-fg)" }}>
                      {fmtDay(r.dayStart)}
                      {r.isLive && (
                        <span
                          className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                          style={{
                            backgroundColor: "rgba(245,158,11,0.15)",
                            color: "#d97706",
                          }}
                        >
                          Live
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--fg)" }}>
                      {r.name}
                      {r.category && (
                        <span className="ml-2 text-[10px]" style={{ color: "var(--muted-fg)" }}>
                          {r.category}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmtQty(r.openingQuantity, r.unit)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: r.received > 0 ? "#10b981" : "var(--muted-fg)" }}>
                      {r.received > 0 ? `+${fmtQty(r.received, r.unit)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: r.consumed > 0 ? "var(--accent-color)" : "var(--muted-fg)" }}>
                      {r.consumed > 0 ? `−${fmtQty(r.consumed, r.unit)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: r.adjusted !== 0 ? "#d97706" : "var(--muted-fg)" }}>
                      {r.adjusted === 0
                        ? "—"
                        : `${r.adjusted > 0 ? "+" : ""}${fmtQty(r.adjusted, r.unit)}`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: "var(--fg)" }}>
                      {fmtQty(r.closingQuantity, r.unit)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: varColor }}>
                      {Math.abs(r.variance) < 0.01
                        ? "—"
                        : `${r.variance > 0 ? "+" : ""}${fmtQty(r.variance, r.unit)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
        BOD = Beginning of Day · EOD = End of Day · Variance = Closing −
        (Opening − Consumed + Received + Adjusted). A non-zero variance means
        someone changed stock without logging a restock or adjustment.
      </p>
    </div>
  );
}
