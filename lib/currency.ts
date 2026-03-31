const CURRENCY_CONFIG: Record<string, { locale: string; currency: string }> = {
  PHP: { locale: "en-PH", currency: "PHP" },
  IDR: { locale: "id-ID", currency: "IDR" },
  MYR: { locale: "ms-MY", currency: "MYR" },
  SGD: { locale: "en-SG", currency: "SGD" },
  THB: { locale: "th-TH", currency: "THB" },
  USD: { locale: "en-US", currency: "USD" },
};

/**
 * Format an amount in smallest currency unit (cents/centavos) to display string.
 * Examples:
 *   formatCurrency(15000, "PHP") => "₱150.00"
 *   formatCurrency(1500000, "IDR") => "Rp 15,000"
 *   formatCurrency(1500, "MYR") => "RM 15.00"
 *   formatCurrency(1500, "SGD") => "S$15.00"
 *   formatCurrency(15000, "THB") => "฿150.00"
 */
export function formatCurrency(amount: number, currency: string = "PHP"): string {
  const config = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.PHP;

  // IDR has no decimal subunit — 1 IDR = 1 smallest unit
  const divisor = currency === "IDR" ? 1 : 100;
  const displayAmount = amount / divisor;

  const formatter = new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.currency,
    minimumFractionDigits: currency === "IDR" ? 0 : 2,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  });

  return formatter.format(displayAmount);
}

/**
 * Returns just the currency symbol for the given currency code.
 */
export function getCurrencySymbol(currency: string): string {
  const config = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.PHP;

  const formatter = new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.currency,
  });

  // Extract symbol from formatted parts
  const parts = formatter.formatToParts(0);
  const symbolPart = parts.find((p: Intl.NumberFormatPart) => p.type === "currency");
  return symbolPart?.value ?? currency;
}
