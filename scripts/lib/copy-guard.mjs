/**
 * The auditable-negative guard, extracted so it can be tested against a fixture.
 *
 * The company guardrail is that an absence of matches carries the same burden as a match: it must
 * state the corpus it was drawn from. A bare "no duplicates found" reads as a statement about the
 * whole organization when the search only ever covered one browser's storage.
 *
 * This lives in its own module and takes the directory as an argument specifically so the check can
 * be exercised against known-bad input. A guard nobody has ever seen fail is a guard nobody knows
 * works - see scripts/test-copy-guard.mjs.
 */
import { readFileSync, readdirSync } from "node:fs";

export const BANNED_PHRASES = [
  "No duplicates found",
  "No duplicates were found",
  "No matches found",
  "No similar requests found",
  "No related work found",
  "Nothing similar found",
];

/**
 * Phrases that claim a request reached Workfront without an Issue ID.
 *
 * Dual-write (decision 035) may show Yes only when a real Issue ID is stored. A bare
 * "Sent to Workfront: Yes" in the bundle is still banned; the UI builds
 * `Yes (Issue ${id})` instead so the literal claim never ships without an ID.
 *
 * Only **affirmative** phrasing is banned. "Sent to Workfront: No" and "not been sent to
 * Workfront" are honest disclosures this guard exists to protect.
 */
export const BANNED_SEND_CLAIMS = [
  "has been sent to Workfront",
  "have been sent to Workfront",
  "was sent to Workfront",
  "were sent to Workfront",
  "Sent to Workfront: Yes",
  "Submitted to Workfront",
  "sent to the Workfront queue",
  "Successfully sent to Workfront",
];

/**
 * Wording that must survive the guard. Asserted in scripts/test-copy-guard.mjs so a future tightening
 * of the patterns above cannot quietly start rejecting the honest disclosures.
 */
export const REQUIRED_SAFE_PHRASES = [
  "Sent to Workfront: No",
  "not been sent to Workfront",
  "it is not sent to Workfront yet",
];

/**
 * Affirmative send with Issue ID is allowed in the bundle (decision 035). Bare Yes without Issue is
 * still in BANNED_SEND_CLAIMS.
 */
export const ALLOWED_SEND_WITH_ID_EXAMPLE = "Yes (Task ";

/** Words that make a negative result auditable by naming what was actually searched. */
export const SCOPE_WORDS = ["this device", "this browser", "Workfront", "saved on"];

/**
 * Greps built JS and CSS for phrasing that states a negative without naming its corpus.
 *
 * Returns a list of problems; an empty list means the check passed. A missing or empty directory is
 * itself reported, so a skipped check can never be mistaken for a passing one.
 */
export function checkBundleCopy(assetsDir = "dist/assets") {
  const problems = [];
  let entries;
  try {
    entries = readdirSync(assetsDir);
  } catch {
    return [`${assetsDir} was not found, so the banned-phrase check did not run. Build first.`];
  }

  const bundles = entries.filter((name) => name.endsWith(".js") || name.endsWith(".css"));
  if (bundles.length === 0) {
    return [`No JS or CSS in ${assetsDir}, so the banned-phrase check did not run.`];
  }

  for (const name of bundles) {
    const source = readFileSync(`${assetsDir}/${name}`, "utf8");
    for (const phrase of BANNED_PHRASES) {
      if (source.includes(phrase)) {
        problems.push(
          `Built bundle ${name} contains the unqualified phrase "${phrase}". A negative result must name the corpus it searched - use describeEmptyResult() in src/lib/related/coverage.ts.`,
        );
      }
    }
    for (const phrase of BANNED_SEND_CLAIMS) {
      if (source.includes(phrase)) {
        problems.push(
          `Built bundle ${name} claims "${phrase}". This build makes no network call, so that is false. Remove the claim; "Sent to Workfront: No" is the accurate wording.`,
        );
      }
    }
  }
  return problems;
}

/**
 * Checks the coverage text that was actually on screen. Complements the grep: the bundle check
 * catches banned wording no test happened to render, this catches correct wording that is missing
 * from the page entirely.
 */
export function checkCoverageSightings(sightings) {
  const problems = [];
  for (const sighting of sightings) {
    if (!sighting.coverage) {
      problems.push(
        `[${sighting.screen}] the Related activity step rendered no .aaa-related-coverage line, so the result does not say what was searched`,
      );
      continue;
    }
    const shown = [sighting.coverage, sighting.empty].filter(Boolean).join(" ");
    if (!SCOPE_WORDS.some((word) => shown.includes(word))) {
      problems.push(`[${sighting.screen}] coverage text names no corpus: "${shown}"`);
    }
  }
  return problems;
}
