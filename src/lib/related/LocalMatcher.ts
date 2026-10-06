/**
 * Deterministic related-work matching. No LLM, no key, no network.
 *
 * Runs while questions are being answered, so a duplicate surfaces at question two rather than
 * after the requester has typed nine answers.
 *
 * Every signal that fires produces a `MatchReason` with human-readable text, because a
 * recommendation a requester cannot audit gets either ignored or blindly trusted, and both are
 * worse than no recommendation. There is no path here that produces an unexplained score.
 */
import {
  localCoverage,
} from "./coverage";
import type {
  CorpusRecord,
  MatchClassification,
  MatchOutcome,
  MatchQuery,
  MatchReason,
  RelatedMatch,
  RelatedWorkMatcher,
} from "./types";

/**
 * Words carrying no distinguishing signal. Without this, two unrelated requests match on "the
 * project needs a new" and the panel cries wolf.
 */
const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","been","but","by","can","do","does","for","from","get","has",
  "have","how","i","if","in","into","is","it","its","just","like","make","more","need","needs","new",
  "not","of","on","or","our","out","over","should","so","some","than","that","the","their","them",
  "then","there","these","they","this","to","up","use","want","was","we","were","what","when","which",
  "who","will","with","would","you","your","please","also","about","before","after","project","work",
  "request","team","help","us",
]);

/**
 * Terms that genuinely distinguish one piece of marketing work from another, weighted higher so a
 * shared product or audience outranks shared filler.
 */
const DISTINCTIVE_TERMS = new Set([
  "annuity","annuities","term","whole","universal","life","final","expense","medicare","supplement",
  "accident","critical","illness","rider","policyholder","member","members","retiree","retirees",
  "retirement","preretiree","senior","seniors","club","agent","agents","broker","enrollment","aep",
  "renewal","lapse","winback","crosssell","upsell","onboarding","claims","underwriting","quote",
  "rate","premium","direct","mail","email","landing","page","social","video","banner","display",
  "print","brochure","flyer","postcard","microsite","webinar","script","testimonial","promotional",
  "campaign","audience","segment","lead","leads",
]);

const DELIVERABLE_TERMS = [
  "direct mail","postcard","brochure","flyer","email","landing page","microsite","banner",
  "display ad","digital ad","social","video","print","billboard","script","webinar","one-pager",
  "presentation","infographic","newsletter",
];

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function weightedOverlap(
  a: string[],
  b: string[],
): { score: number; shared: string[] } {
  if (a.length === 0 || b.length === 0) return { score: 0, shared: [] };
  const setB = new Set(b);
  const shared: string[] = [];
  let weight = 0;
  let total = 0;

  for (const token of new Set(a)) {
    const termWeight = DISTINCTIVE_TERMS.has(token) ? 3 : 1;
    total += termWeight;
    if (setB.has(token)) {
      weight += termWeight;
      shared.push(token);
    }
  }
  if (total === 0) return { score: 0, shared: [] };
  // Rank distinctive shared terms first so the explanation names the meaningful ones.
  shared.sort((x, y) => {
    const dx = DISTINCTIVE_TERMS.has(x) ? 0 : 1;
    const dy = DISTINCTIVE_TERMS.has(y) ? 0 : 1;
    return dx - dy || x.localeCompare(y);
  });
  return { score: weight / total, shared };
}

/** Normalized Levenshtein similarity, to catch a reworded title. */
function titleSimilarity(a: string, b: string): number {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return 0;
  if (x === y) return 1;

  const rows = x.length + 1;
  const cols = y.length + 1;
  let prev = new Array<number>(cols);
  let curr = new Array<number>(cols);
  for (let j = 0; j < cols; j += 1) prev[j] = j;

  for (let i = 1; i < rows; i += 1) {
    curr[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  const distance = prev[cols - 1];
  return 1 - distance / Math.max(x.length, y.length);
}

function daysApart(a: string, b: string): number | null {
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return null;
  return Math.abs(dateA.getTime() - dateB.getTime()) / 86_400_000;
}

function extractDeliverables(text: string): string[] {
  const lower = text.toLowerCase();
  return DELIVERABLE_TERMS.filter((term) => lower.includes(term));
}

function sameTeam(a: string, b: string): boolean {
  return Boolean(a) && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Turns the ALAN number's shared prefix into a partial-match signal. */
function alanPrefixMatch(a: string, b: string): boolean {
  const segA = a.split("-");
  const segB = b.split("-");
  return segA.length >= 2 && segB.length >= 2 && segA[1] === segB[1];
}

export class LocalMatcher implements RelatedWorkMatcher {
  readonly id = "local";

  async match(query: MatchQuery, corpus: CorpusRecord[]): Promise<MatchOutcome> {
    const dismissed = new Set(query.dismissedIds ?? []);
    const candidates = corpus.filter(
      (record) => record.id !== query.excludeId && !dismissed.has(record.id),
    );

    const queryTokens = tokenize(query.conceptText);
    const queryDeliverables =
      query.deliverables.length > 0
        ? query.deliverables
        : extractDeliverables(query.conceptText);

    const matches: RelatedMatch[] = [];

    for (const record of candidates) {
      const reasons: MatchReason[] = [];
      let score = 0;

      // ALAN number - the strongest signal available.
      if (query.alanNumber && record.alanNumber) {
        if (query.alanNumber === record.alanNumber) {
          reasons.push({
            signal: "alan-exact",
            text: `Shares ${record.alanNumber}`,
            weight: 0.6,
          });
          score += 0.6;
        } else if (alanPrefixMatch(query.alanNumber, record.alanNumber)) {
          reasons.push({
            signal: "alan-partial",
            text: `Related ALAN number (${record.alanNumber})`,
            weight: 0.2,
          });
          score += 0.2;
        }
      }

      // Concept overlap.
      const overlap = weightedOverlap(queryTokens, tokenize(record.conceptText));
      if (overlap.score >= 0.18 && overlap.shared.length >= 2) {
        const named = overlap.shared.slice(0, 3).join(", ");
        const weight = Math.min(0.4, overlap.score * 0.5);
        reasons.push({
          signal: "concept-overlap",
          text: `Similar subject matter (${named})`,
          weight,
        });
        score += weight;
      }

      // Reworded title.
      const similarity = titleSimilarity(query.title, record.title);
      if (similarity >= 0.6) {
        const weight = similarity * 0.3;
        reasons.push({
          signal: "title-similarity",
          text: `Almost the same title as "${record.title}"`,
          weight,
        });
        score += weight;
      }

      // Team. Only meaningful once something else already matched, otherwise every request from
      // one department would "match" every other.
      const isSameTeam = sameTeam(query.team, record.team);
      if (reasons.length > 0) {
        if (isSameTeam) {
          reasons.push({
            signal: "same-team",
            text: `Also from ${record.team}`,
            weight: 0.1,
          });
          score += 0.1;
        } else if (record.team) {
          reasons.push({
            signal: "cross-team-concept",
            text: `${record.team} is working on something similar`,
            weight: 0.15,
          });
          score += 0.15;
        }
      }

      // Deadline window. A capacity clash even when the concepts differ, so this can fire alone.
      if (query.deadline && record.deadline) {
        const gap = daysApart(query.deadline, record.deadline);
        if (gap !== null && gap <= 7) {
          reasons.push({
            signal: "deadline-window",
            text:
              gap === 0
                ? `Due the same day (${record.deadline})`
                : `Due within the same week (${record.deadline})`,
            weight: 0.15,
          });
          score += 0.15;
        }
      }

      // Deliverable overlap.
      const recordDeliverables =
        record.deliverables.length > 0
          ? record.deliverables
          : extractDeliverables(record.conceptText);
      const sharedDeliverables = queryDeliverables.filter((item) =>
        recordDeliverables.some((other) => other.toLowerCase() === item.toLowerCase()),
      );
      if (sharedDeliverables.length > 0) {
        const weight = Math.min(0.2, 0.1 * sharedDeliverables.length);
        reasons.push({
          signal: "deliverable-overlap",
          text: `Also needs ${sharedDeliverables.slice(0, 2).join(" and ")}`,
          weight,
        });
        score += weight;
      }

      if (reasons.length === 0) continue;

      const normalized = Math.min(1, score);
      if (normalized < 0.15) continue;

      matches.push({
        record,
        classification: classify(normalized, reasons, isSameTeam),
        score: normalized,
        reasons: reasons.sort((a, b) => b.weight - a.weight),
      });
    }

    matches.sort((a, b) => b.score - a.score);

    return { matches, coverage: localCoverage(corpus) };
  }
}

/**
 * Classification decides how loudly the UI speaks, so the thresholds matter more than the score.
 *
 * A shared ALAN number is a duplicate regardless of score - two requests against one compliance
 * identifier is the exact case this feature exists to catch. An opportunity is the inverse: a
 * different team overlapping on timing or audience, surfaced quietly and never blocking.
 */
function classify(
  score: number,
  reasons: MatchReason[],
  isSameTeam: boolean,
): MatchClassification {
  const signals = new Set(reasons.map((reason) => reason.signal));

  if (signals.has("alan-exact")) return "duplicate";
  if (score >= 0.7) return "duplicate";

  const hasConcept =
    signals.has("concept-overlap") || signals.has("title-similarity");

  if (score >= 0.45 && hasConcept) {
    return isSameTeam ? "duplicate" : "overlap";
  }

  // Timing or format overlap between different teams, with no shared concept: a chance to combine
  // work rather than a conflict.
  if (
    !isSameTeam &&
    !hasConcept &&
    (signals.has("deadline-window") || signals.has("deliverable-overlap"))
  ) {
    return "opportunity";
  }

  return "related";
}

export const defaultMatcher: RelatedWorkMatcher = new LocalMatcher();
