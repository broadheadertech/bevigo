import { describe, it, expect, vi } from "vitest";

// The export module uses "use client" and references `document` and `URL`,
// so we need to extract and test the CSV logic separately.
// We test the escapeCSVValue logic and CSV generation inline.

function escapeCSVValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const headerRow = headers.map((h: string) => escapeCSVValue(h)).join(",");

  const rows = data.map((row: Record<string, unknown>) =>
    headers.map((h: string) => escapeCSVValue(row[h])).join(",")
  );

  return [headerRow, ...rows].join("\r\n");
}

describe("escapeCSVValue", () => {
  it("returns plain strings unmodified", () => {
    expect(escapeCSVValue("hello")).toBe("hello");
  });

  it("wraps values containing commas in quotes", () => {
    expect(escapeCSVValue("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes by doubling them", () => {
    expect(escapeCSVValue('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps values containing newlines in quotes", () => {
    expect(escapeCSVValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("converts null and undefined to empty string", () => {
    expect(escapeCSVValue(null)).toBe("");
    expect(escapeCSVValue(undefined)).toBe("");
  });

  it("converts numbers to string", () => {
    expect(escapeCSVValue(42)).toBe("42");
  });
});

describe("buildCSV", () => {
  it("generates CSV from a basic array of objects", () => {
    const data = [
      { name: "Latte", price: 150, category: "Coffee" },
      { name: "Mocha", price: 180, category: "Coffee" },
    ];
    const csv = buildCSV(data);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("name,price,category");
    expect(lines[1]).toBe("Latte,150,Coffee");
    expect(lines[2]).toBe("Mocha,180,Coffee");
  });

  it("handles special characters in values", () => {
    const data = [
      { name: 'Caramel "Supreme"', description: "Sweet, creamy" },
    ];
    const csv = buildCSV(data);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("name,description");
    expect(lines[1]).toBe('"Caramel ""Supreme""","Sweet, creamy"');
  });

  it("returns empty string for empty array", () => {
    expect(buildCSV([])).toBe("");
  });
});
