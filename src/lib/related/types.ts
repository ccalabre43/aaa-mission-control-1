/**
 * Related-work matching types.
 *
 * Two design constraints drive the shapes here, both from the company guardrails:
 *
 * 1. Every match must state the signal behind it, so `RelatedMatch.reasons` is required, not
 *    optional. There is no way to construct a match without explaining it.
 *
 * 2. An absence of matches is also a recommendation. A bare "no duplicates found" reads as an
 *    organization-wide statement of fact, when in Sprint 1 it means "nothing matched among the
 *    handful of requests saved in this one browser." So a matcher returns a `MatchCoverage`
 *    descriptor alongside its matches and the UI renders the empty state from that descriptor.
 *    This makes it structurally impossible to emit an unqualified negative.
 */

/** How a match relates to the request being written. Drives grouping and emphasis in the UI. */
export type MatchClassification =
  | "duplicate" // very high similarity, or a shared ALAN number
  | "overlap" // high concept similarity across different teams
  | "related" // moderate: useful context, not a conflict
  | "opportunity"; // different teams, same audience or timing: a candidate to combine

export const MATCH_CLASSIFICATION_ORDER: readonly MatchClassification[] = [
  "duplicate",
  "overlap",
  "related",
  "opportunity",
];

/** Which signal fired. Kept as data so the UI can explain itself without hard-coded prose. */
export type MatchSignal =
  | "alan-exact"
  | "alan-partial"
  | "concept-overlap"
  | "title-similarity"
  | "same-team"
  | "cross-team-concept"
  | "deadline-window"
  | "deliverable-overlap";

export interface MatchReason {
  signal: MatchSignal;
  /** Plain-language explanation shown verbatim to the requester. */
  text: string;
  /** Contribution to the score, so the ranking is auditable rather than opaque. */
  weight: number;
}

/**
 * One record in the corpus being searched.
 *
 * Deliberately summary-only. Under the least-privilege guardrail, cross-team data is limited to
 * ALAN number, title, team, status, and match reason - never a brief body, an attachment, or a
 * requester's email. This type is the enforcement point: a match card cannot leak a brief body
 * because the corpus record it renders from does not carry one.
 *
 * `conceptText` exists for scoring only and must never be rendered.
 */
export interface CorpusRecord {
  id: string;
  source: "brief" | "tracker";
  alanNumber: string | null;
  title: string;
  team: string;
  status: string;
  /** ISO `YYYY-MM-DD`, or null when the record has no deadline. */
  deadline: string | null;
  deliverables: string[];
  createdAt: string;
  /** Scoring input only. NEVER render this. */
  conceptText: string;
}

export interface RelatedMatch {
  record: CorpusRecord;
  classification: MatchClassification;
  /** 0..1. Auditable via `reasons`, never presented as an unexplained number. */
  score: number;
  /** At least one. A match with no stated reason is not a valid match. */
  reasons: MatchReason[];
}

/** One contributing part of the corpus, so coverage can be described precisely. */
export interface CoverageSource {
  label: string;
  count: number;
}

/**
 * What was actually searched. Persisted onto the brief at submit time, because a brief checked
 * against one browser must not look identical to one checked against all of Workfront when a
 * reviewer reads it months later.
 */
export interface MatchCoverage {
  scope: "local-device" | "workfront-queue" | "hybrid";
  /**
   * `partial` means the result cannot support an organization-wide claim.
   * Only ever `organization-wide` when the corpus genuinely was.
   */
  completeness: "partial" | "organization-wide";
  /** Records actually compared. */
  corpusSize: number;
  sources: CoverageSource[];
  /** Plain-language reasons coverage is incomplete. Rendered to the user as-is. */
  limitations: string[];
  searchedAt: string;
}

export interface MatchOutcome {
  matches: RelatedMatch[];
  coverage: MatchCoverage;
}

/** What the matcher is scoring against: the request in progress. */
export interface MatchQuery {
  alanNumber: string | null;
  team: string;
  /** Free text from the Context step plus every answer so far. */
  conceptText: string;
  title: string;
  deadline: string | null;
  deliverables: string[];
  /** Records the requester dismissed for this request, suppressed so the panel does not nag. */
  dismissedIds?: string[];
  /** The draft's own id, so a draft never matches itself. */
  excludeId?: string;
}

/**
 * The swap point. Sprint 1 ships a deterministic `LocalMatcher`; a `WorkfrontMatcher` or an
 * embedding-based matcher implements the same interface later without the UI changing.
 *
 * The corpus is an argument rather than something the matcher fetches, which is what makes that
 * swap a substitution instead of a rewrite.
 */
export interface RelatedWorkMatcher {
  readonly id: string;
  match(query: MatchQuery, corpus: CorpusRecord[]): Promise<MatchOutcome>;
}

/** How the requester resolved a surfaced match at the Related activity step. */
export type MatchResolution = "related" | "duplicate" | "not-a-match";

export interface ResolvedMatch {
  recordId: string;
  resolution: MatchResolution;
  /** Carried so a reviewer can see what the requester was told, not just what they decided. */
  classification: MatchClassification;
  alanNumber: string | null;
  title: string;
  resolvedAt: string;
}
