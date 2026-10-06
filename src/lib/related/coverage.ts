/**
 * Turning a `MatchCoverage` descriptor into honest text.
 *
 * This is the only place that phrases a match result for a human, which is deliberate: the
 * guardrail that an absence of matches must state its corpus is enforced by there being no other
 * way to produce that sentence. Nothing in the app renders a bare "no duplicates found".
 */
import type { CorpusRecord, MatchCoverage } from "./types";

/*
 * The banned phrasings are listed in scripts/verify-flow.mjs, not here. They used to sit in this
 * file as an exported constant whose comment claimed a verification grep used it; no such check
 * existed, and a checker whose needle lives inside the code being checked only works for as long as
 * the bundler keeps tree-shaking it out. The list now lives with the check that enforces it.
 */

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Coverage for the Sprint 1 local corpus.
 *
 * Always `partial`, because a browser's own storage can never support an organization-wide claim.
 * That is a fact about the corpus, not a placeholder to be flipped later by hand.
 */
export function localCoverage(corpus: CorpusRecord[]): MatchCoverage {
  const briefCount = corpus.filter((record) => record.source === "brief").length;
  const trackerCount = corpus.filter((record) => record.source === "tracker").length;

  const sources = [];
  if (briefCount > 0) {
    sources.push({ label: "Requests saved in this browser", count: briefCount });
  }
  if (trackerCount > 0) {
    sources.push({ label: "Rows in the Request Queue", count: trackerCount });
  }

  return {
    scope: "local-device",
    completeness: "partial",
    corpusSize: corpus.length,
    sources,
    limitations: [
      "Only requests saved on this device were checked. Other people's requests are not included until Workfront is connected.",
    ],
    searchedAt: new Date().toISOString(),
  };
}

/**
 * The always-visible disclosure beneath the match panel.
 *
 * Reads as a caveat today and simply as a fact once the corpus is organization-wide, which is why
 * it is shown in both cases rather than only on the empty state.
 */
export function describeCoverage(coverage: MatchCoverage | null): string {
  if (!coverage) {
    return "Related work has not been checked yet.";
  }

  const scopeText =
    coverage.corpusSize === 0
      ? "There is nothing to compare against yet"
      : `Checked against ${plural(coverage.corpusSize, "request", "requests")}`;

  const breakdown =
    coverage.sources.length > 0
      ? ` (${coverage.sources
          .map((source) => `${source.count} ${source.label.toLowerCase()}`)
          .join(", ")})`
      : "";

  if (coverage.completeness === "organization-wide") {
    return `${scopeText}${breakdown} across the full Workfront queue.`;
  }

  return `${scopeText}${breakdown}. ${coverage.limitations.join(" ")}`;
}

/**
 * The headline for an empty result. Never states that no duplicate exists, only that none was
 * found in what was actually searched.
 */
export function describeEmptyResult(coverage: MatchCoverage): string {
  if (coverage.corpusSize === 0) {
    return coverage.completeness === "organization-wide"
      ? "Nothing to compare against yet."
      : "No earlier requests are saved on this device yet, so there is nothing to compare against.";
  }
  if (coverage.completeness === "organization-wide") {
    return `No matches across ${plural(coverage.corpusSize, "request", "requests")} in the Workfront queue.`;
  }
  return `No matches among the ${plural(coverage.corpusSize, "request", "requests")} saved on this device.`;
}

/** Short form for the polite live region. Qualified, so a screen reader hears the scope too. */
export function describeCoverageForAnnouncement(
  matchCount: number,
  coverage: MatchCoverage,
): string {
  const scope =
    coverage.completeness === "organization-wide"
      ? "the Workfront queue"
      : "requests on this device";
  if (matchCount === 0) {
    return `No possible matches found in ${scope}.`;
  }
  return `${plural(matchCount, "possible match", "possible matches")} found in ${scope}.`;
}

/**
 * One line for the Workfront Issue description, so a producer or reviewer reading the record knows
 * what the duplicate check actually covered rather than assuming it was thorough.
 */
export function describeCoverageForAudit(coverage: MatchCoverage | null): string {
  if (!coverage) {
    return "not run";
  }
  const when = coverage.searchedAt.slice(0, 10);
  if (coverage.completeness === "organization-wide") {
    return `${coverage.corpusSize} records across the Workfront queue, ${when}`;
  }
  return `${coverage.corpusSize} records on the requester's device only (not organization-wide), ${when}`;
}

/**
 * Merges coverage from several matchers, for when a Workfront-backed corpus joins the local one.
 *
 * The important case is failure. If a remote corpus is unreachable and this quietly returned
 * `organization-wide` from the local half, the result would claim coverage it does not have -
 * strictly worse than returning nothing. So completeness is organization-wide only when every
 * contributing matcher reported it, and a degraded search says so out loud.
 */
export function mergeCoverage(parts: MatchCoverage[]): MatchCoverage {
  if (parts.length === 0) return localCoverage([]);
  if (parts.length === 1) return parts[0];

  const allOrgWide = parts.every(
    (part) => part.completeness === "organization-wide",
  );
  const scopes = new Set(parts.map((part) => part.scope));

  return {
    scope: scopes.size === 1 ? parts[0].scope : "hybrid",
    completeness: allOrgWide ? "organization-wide" : "partial",
    corpusSize: parts.reduce((total, part) => total + part.corpusSize, 0),
    sources: parts.flatMap((part) => part.sources),
    limitations: [...new Set(parts.flatMap((part) => part.limitations))],
    searchedAt: new Date().toISOString(),
  };
}

/**
 * Coverage for a search whose remote half failed. Explicitly partial, with the reason stated.
 * Call this instead of silently falling back to the local result.
 */
export function degradedCoverage(
  localPart: MatchCoverage,
  reason: string,
): MatchCoverage {
  return {
    ...localPart,
    completeness: "partial",
    limitations: [...localPart.limitations, reason],
    searchedAt: new Date().toISOString(),
  };
}
