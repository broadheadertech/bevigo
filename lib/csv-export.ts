/**
 * Convert an array of plain objects into a CSV string and trigger a browser
 * download. Headers are inferred from the first row's keys (preserving
 * insertion order from the server).
 *
 * Values that contain commas, quotes, or newlines get wrapped in quotes
 * with embedded quotes doubled — i.e. RFC 4180-ish escaping that Excel,
 * Numbers, Sheets, and LibreOffice all parse correctly.
 */
export function downloadCsv(
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
  filenameBase: string
): void {
  if (typeof window === "undefined") return;

  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-");
  const filename = `${filenameBase}-${stamp}.csv`;

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => escapeCell(row[h] === undefined || row[h] === null ? "" : row[h]))
        .join(",")
    );
  }

  // Excel needs a BOM to detect UTF-8 reliably on Windows.
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCell(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
