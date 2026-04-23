/**
 * Build a readable SKU from a product name and ensure it doesn't collide
 * with anything in `used`. "Iced Caffe Latte" -> "ICE-CAF-LAT".
 * On collision, appends "-2", "-3" etc. until a free slot is found.
 */
export function generateUniqueSku(name: string, used: Set<string>): string {
  const tokens = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  let base: string;
  if (tokens.length === 0) {
    base = "ITEM";
  } else if (tokens.length === 1) {
    base = tokens[0].slice(0, 6);
  } else {
    base = tokens.slice(0, 3).map((t) => t.slice(0, 3)).join("-");
  }

  if (!used.has(base)) return base;
  for (let n = 2; n < 10000; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
