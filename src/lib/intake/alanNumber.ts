/**
 * ALAN number handling.
 *
 * The ALAN number is the request's primary identifier and the matcher's strongest signal.
 *
 * The field seeds with `ALAN-00000-000-00` (five-three-two digits). That seed is the canonical
 * format for a non-blocking "Wrong format" warning; it is never saved as a real ALAN. Style-guide
 * samples still carry letters or other segment lengths (`ALAN-28515-N22-XX`, etc.); those warn and
 * never block (Postel's Law) while Compliance owns the authoritative format.
 *
 * See docs/decisions/decision-log.md entry 008.
 */

export const ALAN_TEMPLATE = "ALAN-00000-000-00";

/** Accepts 4-5 digits, then letters or digits, then one or two characters. */
const PERMISSIVE = /^ALAN-\d{4,5}-[A-Z0-9]{3}-[A-Z0-9]{1,2}$/i;

/** Canonical displayed template: ALAN-#####-###-##. Used only to decide whether to warn. */
const TEMPLATE_SHAPE = /^ALAN-\d{5}-\d{3}-\d{2}$/i;

/** Loose enough to find candidates in prose or a document's text layer. */
export const ALAN_SEARCH_PATTERN = /ALAN-\d{4,5}-[A-Z0-9]{2,4}-[A-Z0-9]{2}/gi;

export type AlanValidity = "empty" | "valid" | "unusual" | "unrecognized";

export interface AlanValidation {
  validity: AlanValidity;
  /** Present for `unusual` and `unrecognized`. Never blocks submission. */
  warning?: string;
  /** Uppercased and trimmed. */
  normalized: string;
}

const WRONG_FORMAT = "Wrong format";

export function normalizeAlan(value: string): string {
  return value.trim().toUpperCase();
}

/** True when the value is exactly the seed/placeholder template (not a real ALAN). */
export function isAlanTemplate(value: string): boolean {
  return normalizeAlan(value) === ALAN_TEMPLATE;
}

/**
 * Value to persist or match on: empty and the seed template both mean "no ALAN".
 */
export function resolvedAlanNumber(value: string): string | null {
  const normalized = normalizeAlan(value);
  if (!normalized || isAlanTemplate(normalized)) return null;
  return normalized;
}

export function validateAlan(value: string): AlanValidation {
  const normalized = normalizeAlan(value);
  if (!normalized) return { validity: "empty", normalized };

  if (TEMPLATE_SHAPE.test(normalized)) {
    return { validity: "valid", normalized };
  }

  if (PERMISSIVE.test(normalized)) {
    return {
      validity: "unusual",
      normalized,
      warning: WRONG_FORMAT,
    };
  }

  return {
    validity: "unrecognized",
    normalized,
    warning: WRONG_FORMAT,
  };
}

/** Never blocks. The warning is advisory only, by decision. */
export function blocksSubmission(): boolean {
  return false;
}

/**
 * Distinct known numbers, most recent first.
 *
 * Recency ordering is deliberate: per the Serial Position Effect, the items at the start of a list
 * are the ones a user actually notices, and the most recently used number is the likeliest choice.
 */
export function collectKnownAlanNumbers(
  entries: Array<{ alanNumber: string | null; createdAt: string }>,
  mostRecent: string | null,
): string[] {
  const ordered = [...entries]
    .filter((entry) => entry.alanNumber)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((entry) => normalizeAlan(entry.alanNumber as string));

  const seen = new Set<string>();
  const result: string[] = [];
  if (mostRecent) {
    const normalized = normalizeAlan(mostRecent);
    seen.add(normalized);
    result.push(normalized);
  }
  for (const value of ordered) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

/** Pulls ALAN-shaped strings out of free text, deduplicated in first-seen order. */
export function findAlanCandidates(text: string): string[] {
  const found = text.match(ALAN_SEARCH_PATTERN) ?? [];
  return [...new Set(found.map(normalizeAlan))];
}
