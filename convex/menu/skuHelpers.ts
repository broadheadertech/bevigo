/**
 * SKU format: {firstLetterOfCategory}{firstLetterOfName}{NNN}
 *
 * Examples:
 *   category="Iced Coffee Series", name="Caffe Latte"  -> IC000
 *   category="Iced Coffee Series", name="Caramel Macchiato" -> IC001
 *   category="Hot Coffee Series", name="Americano" -> HA000
 *
 * The 3-digit counter is per (categoryLetter + nameLetter) prefix, padded to
 * 3 digits and starting at 000. Caller passes the existing SKUs for that
 * tenant so we can find the next free slot without colliding.
 */
export function generateUniqueSku(
  name: string,
  used: Set<string>,
  categoryName?: string
): string {
  const catLetter = firstAlphaUpper(categoryName ?? "X");
  const nameLetter = firstAlphaUpper(name);
  const prefix = `${catLetter}${nameLetter}`;

  for (let n = 0; n < 1000; n++) {
    const candidate = `${prefix}${String(n).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  // Astronomically unlikely overflow guard — fall back to a longer suffix.
  for (let n = 1000; n < 100000; n++) {
    const candidate = `${prefix}${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${prefix}${Date.now()}`;
}

function firstAlphaUpper(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z]/g, "");
  return cleaned.length > 0 ? cleaned.charAt(0) : "X";
}
