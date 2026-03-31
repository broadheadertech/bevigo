"use client";

export function exportReportPDF(
  title: string,
  data: Record<string, string | number>[],
  columns: { key: string; label: string }[],
  summary?: Record<string, string>
): void {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const summaryHTML = summary
    ? `<div class="summary">
        ${Object.entries(summary)
          .map(
            ([label, value]: [string, string]) =>
              `<div class="summary-item"><span class="summary-label">${label}</span><span class="summary-value">${value}</span></div>`
          )
          .join("")}
      </div>`
    : "";

  const headerRow = columns
    .map((col: { key: string; label: string }) => `<th>${col.label}</th>`)
    .join("");

  const dataRows = data
    .map(
      (row: Record<string, string | number>) =>
        `<tr>${columns
          .map(
            (col: { key: string; label: string }) =>
              `<td>${row[col.key] ?? ""}</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} - bevi&amp;go</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1c1917;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #1c1917;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .header h2 {
      font-size: 22px;
      font-weight: 700;
      margin: 8px 0 4px 0;
    }
    .header .date {
      font-size: 12px;
      color: #78716c;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      margin-bottom: 24px;
      padding: 16px;
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 8px;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
    }
    .summary-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #78716c;
    }
    .summary-value {
      font-size: 18px;
      font-weight: 700;
      color: #1c1917;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #78716c;
      border-bottom: 2px solid #e7e5e4;
      background: #fafaf9;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #f5f5f4;
    }
    tr:last-child td {
      border-bottom: 2px solid #e7e5e4;
    }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e7e5e4;
      font-size: 11px;
      color: #a8a29e;
      text-align: center;
    }
    .print-btn {
      display: inline-block;
      margin-bottom: 24px;
      padding: 10px 24px;
      background: #1c1917;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .print-btn:hover { background: #292524; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="header">
    <h1>bevi&amp;go</h1>
    <h2>${title}</h2>
    <div class="date">Generated on ${dateStr} at ${timeStr}</div>
  </div>
  ${summaryHTML}
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${dataRows}</tbody>
  </table>
  <div class="footer">bevi&amp;go POS &mdash; ${dateStr}</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
