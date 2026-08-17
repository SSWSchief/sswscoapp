/**
 * Employee IDs are a database key, not something an administrator should have
 * to invent. SSWSCO runs no staff-number scheme, so the field was answered with
 * whatever the person *was* — two owners both entered as "Owner", the second
 * rejected as a duplicate. One is derived from the name instead, and the field
 * only has to be touched by a company that genuinely numbers its staff.
 */

/** Leaves room for a uniqueness suffix inside the column's 50-character limit. */
const MAX_BASE_LENGTH = 20;
/** Used when a name carries no letters or digits at all. */
const FALLBACK = "EMP";

/**
 * First initial and surname — "Norberto Angulo" becomes "NANGULO". Recognisable
 * on a report without needing a legend, and stable enough that the same person
 * entered twice collides loudly rather than silently creating a second profile.
 */
export function deriveEmployeeId(fullName: string): string {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  if (!parts.length) return FALLBACK;
  const base =
    parts.length === 1
      ? parts[0]
      : `${parts[0][0]}${parts[parts.length - 1]}`;
  return base.toUpperCase().slice(0, MAX_BASE_LENGTH) || FALLBACK;
}

/**
 * The first free variant of `base`, given the IDs already spoken for. Compared
 * case-insensitively: the unique index is not, but two employees separated only
 * by capitalisation is a trap rather than a distinction.
 *
 * `taken` must include soft-deleted employees. They keep their ID, and they are
 * invisible on every screen an administrator can reach — the case that produced
 * an unexplainable duplicate in the first place.
 */
export function nextAvailableEmployeeId(
  base: string,
  taken: Iterable<string>,
): string {
  const used = new Set(
    [...taken].map((value) => value.trim().toUpperCase()),
  );
  if (!used.has(base.toUpperCase())) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  // Beyond a thousand identical surnames, fall back to something unique rather
  // than looping: the insert still validates it.
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}
