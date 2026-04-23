"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { parseCsv, parseBool, downloadCsv } from "@/lib/csv";

type ImportItemsModalProps = {
  onClose: () => void;
};

type ParsedRow = {
  name: string;
  category: string;
  basePrice: number;
  sku?: string;
  description?: string;
  isFeatured?: boolean;
  errors: string[];
};

type ImportResult = {
  created: number;
  createdCategories: number;
  skipped: Array<{ row: number; reason: string }>;
};

const TEMPLATE_HEADERS = [
  "name",
  "category",
  "basePrice",
  "sku",
  "description",
  "isFeatured",
];

const TEMPLATE_CSV = `name,category,basePrice,sku,description,isFeatured
Cappuccino,Hot Drinks,150.00,CAP-12,Espresso with steamed milk,true
Iced Americano,Cold Drinks,140.00,AME-16,Espresso shaken over ice,false
Chicken Pesto Panini,Food,180.00,PAN-CHK,Pressed sandwich with pesto,false
`;

export function ImportItemsModal({ onClose }: ImportItemsModalProps) {
  const { token } = useAuth();
  const bulkImport = useMutation(api.menu.bulkMutations.bulkImportItems);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
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
      for (const h of TEMPLATE_HEADERS) {
        // Store index under the lowercase key so the reads below match.
        idx[h.toLowerCase()] = header.indexOf(h.toLowerCase());
      }
      if (idx.name === -1 || idx.category === -1 || idx.baseprice === -1) {
        setParseError(
          'Missing required columns. Headers must include: name, category, basePrice.'
        );
        return;
      }

      const parsed: ParsedRow[] = grid.slice(1).map((cells) => {
        const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
        const name = get(idx.name);
        const category = get(idx.category);
        const priceRaw = get(idx.baseprice);
        const sku = get(idx.sku);
        const description = get(idx.description);
        const featuredRaw = get(idx.isfeatured);

        const errors: string[] = [];
        if (!name) errors.push("Missing name");
        if (!category) errors.push("Missing category");
        const priceNum = parseFloat(priceRaw);
        if (!priceRaw || !Number.isFinite(priceNum) || priceNum <= 0) {
          errors.push("Invalid basePrice");
        }

        return {
          name,
          category,
          basePrice: Math.round(priceNum * 100),
          sku: sku || undefined,
          description: description || undefined,
          isFeatured: featuredRaw ? parseBool(featuredRaw) : false,
          errors,
        };
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
          name: r.name,
          category: r.category,
          basePrice: r.basePrice,
          sku: r.sku,
          description: r.description,
          isFeatured: r.isFeatured,
        })),
      });
      setResult(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadCsv("products-template.csv", TEMPLATE_CSV);
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
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              Import Products from CSV
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              Upload a CSV file to create many products at once
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

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {/* Result view */}
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
                      Products created
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
                      {result.createdCategories}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      Categories added
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
            /* File picker view */
            <div className="space-y-4">
              <div
                className="rounded-2xl p-5 text-sm"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}
              >
                <p className="font-semibold mb-2">CSV format</p>
                <p className="mb-2" style={{ color: "var(--muted-fg)" }}>
                  Required columns: <code>name</code>, <code>category</code>,{" "}
                  <code>basePrice</code>. Optional: <code>sku</code>,{" "}
                  <code>description</code>, <code>isFeatured</code>.
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                  <li>Prices are in pesos (e.g. 150.00)</li>
                  <li>Missing categories will be created automatically</li>
                  <li>Rows with an existing SKU will be skipped</li>
                </ul>
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-colors"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                Download CSV Template
              </button>

              <label
                className="block w-full py-10 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-colors"
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
            /* Preview view */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <p style={{ color: "var(--muted-fg)" }}>
                  <span className="font-semibold" style={{ color: "var(--fg)" }}>
                    {fileName}
                  </span>{" "}
                  &middot; {rows.length} rows
                </p>
                <div className="flex gap-3 text-xs">
                  <span style={{ color: "var(--accent-color)" }}>
                    {validCount} valid
                  </span>
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
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Name</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Category</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Price</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">SKU</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: "var(--fg)" }}>
                      {rows.map((r, i) => (
                        <tr
                          key={i}
                          style={{ borderTop: "1px solid var(--border-color)" }}
                        >
                          <td className="px-3 py-2" style={{ color: "var(--muted-fg)" }}>
                            {i + 2}
                          </td>
                          <td className="px-3 py-2">{r.name || "—"}</td>
                          <td className="px-3 py-2">{r.category || "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {Number.isFinite(r.basePrice) && r.basePrice > 0
                              ? `\u20B1${(r.basePrice / 100).toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2" style={{ color: "var(--muted-fg)" }}>
                            {r.sku || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {r.errors.length === 0 ? (
                              <span style={{ color: "var(--accent-color)" }}>
                                Ready
                              </span>
                            ) : (
                              <span className="text-red-400">
                                {r.errors.join(", ")}
                              </span>
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

        {/* Footer */}
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
                {isImporting ? "Importing..." : `Import ${validCount} product${validCount === 1 ? "" : "s"}`}
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
