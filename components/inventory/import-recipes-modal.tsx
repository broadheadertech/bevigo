"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { parseCsv, downloadCsv } from "@/lib/csv";

type ImportRecipesModalProps = {
  onClose: () => void;
};

type ParsedRow = {
  menuItemSku: string;
  ingredientName: string;
  quantityUsed: number;
  errors: string[];
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: Array<{ row: number; reason: string }>;
};

const TEMPLATE_HEADERS = ["menuItemSku", "ingredientName", "quantityUsed"];

const TEMPLATE_CSV = `menuItemSku,ingredientName,quantityUsed
CAP-12,Espresso Beans,0.018
CAP-12,Whole Milk,0.18
CAP-12,Paper Cups 12oz,1
AME-16,Espresso Beans,0.018
AME-16,Paper Cups 12oz,1
`;

export function ImportRecipesModal({ onClose }: ImportRecipesModalProps) {
  const { token } = useAuth();
  const bulkImport = useMutation(api.inventory.recipeMutations.bulkImportRecipes);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validCount = useMemo(
    () => rows?.filter((r) => r.errors.length === 0).length ?? 0,
    [rows]
  );
  const invalidCount = (rows?.length ?? 0) - validCount;

  const handleFile = async (file: File) => {
    setParseError(null);
    setResult(null);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length === 0) {
        setParseError("File is empty.");
        return;
      }
      const header = grid[0].map((h) => h.trim().toLowerCase());
      const idx: Record<string, number> = {};
      for (const h of TEMPLATE_HEADERS) idx[h.toLowerCase()] = header.indexOf(h.toLowerCase());

      if (
        idx.menuitemsku === -1 ||
        idx.ingredientname === -1 ||
        idx.quantityused === -1
      ) {
        setParseError(
          "Missing required columns. Headers must include: menuItemSku, ingredientName, quantityUsed."
        );
        return;
      }

      const parsed: ParsedRow[] = grid.slice(1).map((cells) => {
        const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
        const menuItemSku = get(idx.menuitemsku);
        const ingredientName = get(idx.ingredientname);
        const qtyRaw = get(idx.quantityused);

        const errors: string[] = [];
        if (!menuItemSku) errors.push("Missing menuItemSku");
        if (!ingredientName) errors.push("Missing ingredientName");
        const qty = parseFloat(qtyRaw);
        if (!qtyRaw || !Number.isFinite(qty) || qty <= 0)
          errors.push("Invalid quantityUsed");

        return { menuItemSku, ingredientName, quantityUsed: qty, errors };
      });

      if (parsed.length === 0) {
        setParseError("No data rows found below the header.");
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const handleConfirm = async () => {
    if (!token || !rows) return;
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) return;
    setIsImporting(true);
    try {
      const res = await bulkImport({
        token,
        rows: valid.map((r) => ({
          menuItemSku: r.menuItemSku,
          ingredientName: r.ingredientName,
          quantityUsed: r.quantityUsed,
        })),
      });
      setResult(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setRows(null);
    setFileName("");
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              Import Recipes from CSV
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              Link menu items to ingredients in bulk
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {result ? (
            <div className="space-y-4">
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}
              >
                <p className="text-base font-bold mb-3" style={{ color: "var(--fg)" }}>
                  Import Complete
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "var(--accent-color)" }}>
                      {result.created}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      Recipe lines added
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
                      {result.updated}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      Existing lines updated
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-400">
                      {result.skipped.length}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      Skipped
                    </p>
                  </div>
                </div>
              </div>
              {result.skipped.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                    Skipped rows
                  </p>
                  <div
                    className="rounded-2xl divide-y text-sm"
                    style={{ border: "1px solid var(--border-color)" }}
                  >
                    {result.skipped.map((s, i) => (
                      <div
                        key={i}
                        className="px-4 py-2 flex justify-between"
                        style={{ color: "var(--fg)" }}
                      >
                        <span>Row {s.row}</span>
                        <span className="text-red-400 text-xs">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !rows ? (
            <div className="space-y-4">
              <div
                className="rounded-2xl p-5 text-sm"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}
              >
                <p className="font-semibold mb-2">CSV format</p>
                <p className="mb-2" style={{ color: "var(--muted-fg)" }}>
                  Required: <code>menuItemSku</code>, <code>ingredientName</code>,{" "}
                  <code>quantityUsed</code>.
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                  <li>One row per ingredient line in a recipe</li>
                  <li><code>quantityUsed</code> is in the ingredient's unit (e.g. 0.018 kg of beans per cup)</li>
                  <li>Set products' SKUs first; rows with an unknown SKU are skipped</li>
                  <li>Existing recipe lines are updated with the new quantity</li>
                </ul>
              </div>
              <button
                onClick={() => downloadCsv("recipes-template.csv", TEMPLATE_CSV)}
                className="w-full py-3 rounded-2xl text-sm font-semibold"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Download CSV Template
              </button>
              <label
                className="block w-full py-10 rounded-2xl border-2 border-dashed text-center cursor-pointer"
                style={{ borderColor: "var(--border-color)", color: "var(--muted-fg)" }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                  Click to choose a CSV file
                </p>
                <p className="text-xs mt-1">or drop it here</p>
              </label>
              {parseError && (
                <p className="text-sm text-center p-3 rounded-2xl bg-red-500/10 text-red-400">
                  {parseError}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <p style={{ color: "var(--muted-fg)" }}>
                  <span className="font-semibold" style={{ color: "var(--fg)" }}>
                    {fileName}
                  </span>{" "}
                  &middot; {rows.length} rows
                </p>
                <div className="flex gap-3 text-xs">
                  <span style={{ color: "var(--accent-color)" }}>{validCount} valid</span>
                  {invalidCount > 0 && (
                    <span className="text-red-400">{invalidCount} invalid</span>
                  )}
                </div>
              </div>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid var(--border-color)" }}
              >
                <div className="overflow-auto max-h-[50vh]">
                  <table className="w-full text-xs">
                    <thead style={{ backgroundColor: "var(--muted)" }}>
                      <tr style={{ color: "var(--muted-fg)" }}>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">#</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Menu SKU</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Ingredient</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Qty</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: "var(--fg)" }}>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border-color)" }}>
                          <td className="px-3 py-2" style={{ color: "var(--muted-fg)" }}>{i + 2}</td>
                          <td className="px-3 py-2">{r.menuItemSku || "—"}</td>
                          <td className="px-3 py-2">{r.ingredientName || "—"}</td>
                          <td className="px-3 py-2 text-right">{Number.isFinite(r.quantityUsed) && r.quantityUsed > 0 ? r.quantityUsed : "—"}</td>
                          <td className="px-3 py-2">
                            {r.errors.length === 0 ? (
                              <span style={{ color: "var(--accent-color)" }}>Ready</span>
                            ) : (
                              <span className="text-red-400">{r.errors.join(", ")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {parseError && (
                <p className="text-sm text-center p-3 rounded-2xl bg-red-500/10 text-red-400">
                  {parseError}
                </p>
              )}
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 flex justify-end gap-3"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          {result ? (
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              Done
            </button>
          ) : rows ? (
            <>
              <button
                onClick={handleReset}
                disabled={isImporting}
                className="px-5 py-2.5 rounded-2xl text-sm font-medium"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Choose another file
              </button>
              <button
                onClick={handleConfirm}
                disabled={isImporting || validCount === 0}
                className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-color)" }}
              >
                {isImporting ? "Importing..." : `Import ${validCount} line${validCount === 1 ? "" : "s"}`}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-sm font-medium"
              style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
