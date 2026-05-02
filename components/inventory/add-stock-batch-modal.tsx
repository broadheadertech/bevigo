"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type IngredientOpt = {
  _id: Id<"ingredients">;
  name: string;
  unit: string;
  category?: string;
  status: "active" | "inactive";
  stockQuantity: number | null;
};

type SupplierOpt = {
  _id: Id<"suppliers">;
  name: string;
  status: "active" | "inactive";
};

type Row = {
  rowId: string; // local
  ingredientId: Id<"ingredients"> | "";
  quantity: string;
};

type Props = {
  locationId: Id<"locations">;
  onClose: () => void;
  onDone?: () => void;
};

function todayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultBatchLabel(dateStr: string): string {
  return `Batch ${dateStr}`;
}

export function AddStockBatchModal({ locationId, onClose, onDone }: Props) {
  const { token } = useAuth();
  const ingredients = useQuery(
    api.inventory.queries.listIngredients,
    token ? { token, locationId } : "skip"
  ) as IngredientOpt[] | undefined;
  const suppliers = useQuery(
    api.suppliers.queries.list,
    token ? { token } : "skip"
  ) as SupplierOpt[] | undefined;

  const restockBatch = useMutation(api.inventory.adjustmentMutations.restockBatch);

  const [dateStr, setDateStr] = useState(todayDateString());
  const [batchLabel, setBatchLabel] = useState(defaultBatchLabel(todayDateString()));
  const [supplierId, setSupplierId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { rowId: "r1", ingredientId: "", quantity: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const activeIngredients = useMemo(
    () => (ingredients ?? []).filter((i) => i.status === "active"),
    [ingredients]
  );
  const ingMap = useMemo(
    () => new Map(activeIngredients.map((i) => [String(i._id), i])),
    [activeIngredients]
  );
  const trimmedSearch = search.trim().toLowerCase();
  const visibleIngredients = trimmedSearch
    ? activeIngredients.filter(
        (i) =>
          i.name.toLowerCase().includes(trimmedSearch) ||
          (i.category ?? "").toLowerCase().includes(trimmedSearch)
      )
    : activeIngredients;

  // Track which ingredients are already in the rows so we don't duplicate.
  const usedIds = new Set(rows.map((r) => r.ingredientId).filter(Boolean));

  const addRow = (ingredientId: Id<"ingredients">) => {
    setRows((prev) => [
      ...prev.filter((r) => r.ingredientId !== "" || r.quantity !== ""),
      {
        rowId: `r${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ingredientId,
        quantity: "",
      },
    ]);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.rowId !== rowId);
      if (next.length === 0) return [{ rowId: "r1", ingredientId: "", quantity: "" }];
      return next;
    });
  };

  const setRowQty = (rowId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, quantity: value } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const payload = rows
        .filter((r) => r.ingredientId !== "" && parseFloat(r.quantity) > 0)
        .map((r) => ({
          ingredientId: r.ingredientId as Id<"ingredients">,
          quantity: parseFloat(r.quantity),
        }));
      if (payload.length === 0) {
        throw new Error("Add at least one ingredient with a positive quantity");
      }
      await restockBatch({
        token,
        locationId,
        batchLabel: batchLabel.trim() || defaultBatchLabel(dateStr),
        batchDate: new Date(dateStr).getTime(),
        supplierId: supplierId ? (supplierId as Id<"suppliers">) : undefined,
        notes: notes.trim() || undefined,
        rows: payload,
      });
      onDone?.();
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Restock failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              Add Stock (Restock Batch)
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              Logs one row per ingredient and groups them under a batch label so
              you can audit the delivery later.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl font-bold transition-colors active:scale-95"
            style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
          >
            &#10005;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
            {err && (
              <div className="p-3 rounded-2xl text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                {err}
              </div>
            )}

            {/* Batch metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Batch label *">
                <input
                  type="text"
                  required
                  value={batchLabel}
                  onChange={(e) => setBatchLabel(e.target.value)}
                  placeholder="e.g. PO-1023 or Apr-28 morning delivery"
                  className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                />
              </Field>
              <Field label="Date received *">
                <input
                  type="date"
                  required
                  value={dateStr}
                  onChange={(e) => {
                    setDateStr(e.target.value);
                    // If the user hasn't typed a custom label yet, refresh it.
                    setBatchLabel((prev) =>
                      prev === defaultBatchLabel(dateStr) || prev === ""
                        ? defaultBatchLabel(e.target.value)
                        : prev
                    );
                  }}
                  className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Supplier (optional)">
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                >
                  <option value="">— None —</option>
                  {(suppliers ?? []).filter((s) => s.status === "active").map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notes (optional)">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Invoice #, driver, anything to remember"
                  className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                />
              </Field>
            </div>

            {/* Rows */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Items received
                </p>
                <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
                  {rows.filter((r) => r.ingredientId).length} item{rows.filter((r) => r.ingredientId).length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="rounded-2xl p-3 mb-3" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ingredient to add…"
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none mb-2"
                  style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                />
                <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1">
                  {visibleIngredients.length === 0 ? (
                    <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      No ingredients match.
                    </span>
                  ) : (
                    visibleIngredients
                      .filter((i) => !usedIds.has(i._id))
                      .slice(0, 50)
                      .map((i) => (
                        <button
                          key={i._id}
                          type="button"
                          onClick={() => addRow(i._id)}
                          className="px-2.5 py-1 rounded-xl text-xs transition-colors active:scale-95"
                          style={{ backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                          title={`Add ${i.name}`}
                        >
                          + {i.name} <span className="opacity-60">({i.unit})</span>
                        </button>
                      ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {rows.map((r) => {
                  const ing = r.ingredientId ? ingMap.get(String(r.ingredientId)) : undefined;
                  return (
                    <div key={r.rowId} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-7 px-3 py-2 rounded-xl text-sm truncate" style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}>
                        {ing ? (
                          <>
                            <span className="font-medium">{ing.name}</span>
                            {ing.category && (
                              <span className="ml-2 text-[10px]" style={{ color: "var(--muted-fg)" }}>
                                {ing.category}
                              </span>
                            )}
                            <span className="ml-2 text-[10px]" style={{ color: "var(--muted-fg)" }}>
                              on hand: {(ing.stockQuantity ?? 0).toFixed(1)}{ing.unit}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "var(--muted-fg)" }}>
                            Pick an ingredient from the chips above
                          </span>
                        )}
                      </div>
                      <div className="col-span-4 flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.quantity}
                          onChange={(e) => setRowQty(r.rowId, e.target.value)}
                          placeholder="0"
                          disabled={!ing}
                          className="w-full rounded-xl px-3 py-2 text-sm text-right focus:outline-none disabled:opacity-50"
                          style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                        />
                        {ing && (
                          <span className="text-xs shrink-0 w-8" style={{ color: "var(--muted-fg)" }}>
                            {ing.unit}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(r.rowId)}
                        aria-label="Remove row"
                        className="col-span-1 w-9 h-9 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/10 active:scale-95 transition-colors"
                      >
                        &#10005;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 flex justify-end gap-3 shrink-0" style={{ borderTop: "1px solid var(--border-color)" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-3 rounded-2xl text-sm font-medium"
              style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              {busy ? "Saving…" : "Add to Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-fg)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
