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
 * Phrases that claim a request reached Workfront. Nothing in this build makes a network call, so any
 * one of these in the bundle is false.
 *
 * Only **affirmative** phrasing is banned, and the distinction is the entire point. The Request Queue
 * shows "Sent to Workfront: No" on every row and the confirmed screen says a request is "not sent to
 * Workfront yet" - that copy is the honest disclosure this guard exists to protect, so a naive
 * substring ban on "sent to Workfront" would fail the build for saying the true thing. Each entry
 * below is therefore anchored on the words that make it a claim: "has been", "was", ": Yes".
 *
 * Kept separate from BANNED_PHRASES so the failure message can explain the right thing. A negative
 * result needs its corpus named; a false send claim needs deleting.
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
