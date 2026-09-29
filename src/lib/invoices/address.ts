interface ParsedUsAddress {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

/**
 * Split a one-line job address ("123 Main St, Las Vegas, NV 89101") into
 * billing fields. Returns null for anything that doesn't have that shape, so
 * the caller never bills a guessed city or ZIP.
 */
export function parseUsAddress(value: string): ParsedUsAddress | null {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (/^(USA|US|United States)$/i.test(parts[parts.length - 1] ?? "")) parts.pop();
  if (parts.length < 3) return null;
  const match = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(parts[parts.length - 1]);
  if (!match) return null;
  const city = parts[parts.length - 2];
  const addressLine1 = parts.slice(0, -2).join(", ");
  if (!addressLine1 || !city) return null;
  return { addressLine1, city, state: match[1].toUpperCase(), postalCode: match[2] };
}
