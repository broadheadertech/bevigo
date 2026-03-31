import { describe, it, expect } from "vitest";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";

describe("formatCurrency", () => {
  it("formats PHP amounts (centavos to pesos)", () => {
    const result = formatCurrency(15000, "PHP");
    // Should produce something like "₱150.00"
    expect(result).toContain("150");
    expect(result).toContain(".00");
  });

  it("formats IDR amounts (no decimal subunit)", () => {
    const result = formatCurrency(1500000, "IDR");
    // IDR has no subunit, so 1500000 stays 1,500,000
    expect(result).toContain("1,500,000");
    // Should not have decimal places
    expect(result).not.toContain(".00");
  });

  it("defaults to PHP when no currency is specified", () => {
    const result = formatCurrency(10000);
    // Default is PHP, so 10000 centavos = 100.00 pesos
    expect(result).toContain("100");
    expect(result).toContain(".00");
  });

  it("formats zero amounts correctly", () => {
    const result = formatCurrency(0, "PHP");
    expect(result).toContain("0");
  });

  it("formats large amounts correctly", () => {
    const result = formatCurrency(10000000, "PHP");
    // 10,000,000 centavos = 100,000.00 PHP
    expect(result).toContain("100,000");
  });

  it("falls back to PHP config for unknown currency codes", () => {
    const result = formatCurrency(5000, "XYZ");
    // Should use PHP config as fallback but with XYZ as currency code
    // The divisor won't be IDR-specific, so 5000/100 = 50
    expect(result).toContain("50");
  });
});

describe("getCurrencySymbol", () => {
  it("returns the symbol for PHP", () => {
    const symbol = getCurrencySymbol("PHP");
    expect(symbol).toBe("₱");
  });

  it("returns the symbol for IDR", () => {
    const symbol = getCurrencySymbol("IDR");
    expect(symbol).toContain("Rp");
  });
});
