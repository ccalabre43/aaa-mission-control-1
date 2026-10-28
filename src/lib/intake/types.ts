import type { A3Values } from "./a3Schema";
import type { MatchCoverage, ResolvedMatch } from "../related/types";

/**
 * The intake brief: everything captured during a request, plus the audit trail a reviewer needs.
 *
 * Storage keys are separate from the Request Queue's `aaa-project-tracker`, which is never renamed
 * without a migration.
 */
export const BRIEF_STORAGE_KEY = "aaa-intake-briefs";
export const BRIEF_BACKUP_KEY = "aaa-intake-briefs-backup";
export const IDENTITY_STORAGE_KEY = "aaa-intake-identity";
export const RECENT_ALAN_KEY = "aaa-intake-recent-alan";
export const QUESTION_REGISTRY_KEY = "aaa-intake-question-registry";

export type BriefStatus = "draft" | "submitted";

/**
 * Local reviewer workflow on the Mission Control queue.
 *
 * Not an A3 / Workfront custom-form field. Preferred later targets are native Issue `status` and
 * `priority` — see docs/knowledge/reviewer-queue-fields.md. Until dual-write maps them, they stay
 * on the device with the brief.
 */
export type ReviewerStatus =
  | "needs_review"
  | "needs_clarification"
  | "escalated"
  | "approved"
  | "closed"
  | "deferred";

export type ReviewerPriority = "P1" | "P2" | "P3";

/** Local triage assessment on the summary page. Not an A3 / Workfront field. */
export type ReviewerAssessmentLevel = "high" | "medium" | "low";

/** Local job-size estimate on the summary page (Concept v1). Not an A3 / Workfront field. */
export type ReviewerSize = "S" | "M" | "L";

export interface BriefReviewer {
  status: ReviewerStatus;
  priority: ReviewerPriority;
  /** ISO when a reviewer first opened or changed status; null drives the NEW badge. */
  firstReviewedAt: string | null;
  /** Shirt size S/M/L for triage. */
  size: ReviewerSize;
  impact: ReviewerAssessmentLevel;
  effort: ReviewerAssessmentLevel;
  risk: ReviewerAssessmentLevel;
}

export const REVIEWER_STATUSES: readonly { value: ReviewerStatus; label: string }[] = [
  { value: "needs_review", label: "Needs review" },
  { value: "needs_clarification", label: "Needs clarification" },
  { value: "escalated", label: "Escalated" },
  { value: "approved", label: "Approved — transfer" },
  { value: "closed", label: "Closed" },
  { value: "deferred", label: "Deferred to backlog" },
] as const;

export const REVIEWER_PRIORITIES: readonly ReviewerPriority[] = ["P1", "P2", "P3"] as const;

export const REVIEWER_ASSESSMENT_LEVELS: readonly {
  value: ReviewerAssessmentLevel;
  label: string;
}[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export const REVIEWER_SIZES: readonly { value: ReviewerSize; label: string }[] = [
  { value: "S", label: "Small" },
  { value: "M", label: "Medium" },
  { value: "L", label: "Large" },
] as const;

export function defaultReviewer(): BriefReviewer {
  return {
    status: "needs_review",
    priority: "P2",
    firstReviewedAt: null,
    size: "M",
    impact: "high",
    effort: "medium",
    risk: "low",
  };
}

export function assessmentLabel(level: ReviewerAssessmentLevel): string {
  return REVIEWER_ASSESSMENT_LEVELS.find((item) => item.value === level)?.label ?? level;
}

export function sizeLabel(size: ReviewerSize): string {
  return REVIEWER_SIZES.find((item) => item.value === size)?.label ?? size;
}

export function reviewerStatusLabel(status: ReviewerStatus): string {
  return REVIEWER_STATUSES.find((item) => item.value === status)?.label ?? status;
}

/**
 * The seven steps from assets/mocks/requestor-ux-flow.jpg.
 *
 * `start` is Step 1. The stepper drawn in the mocks begins numbering at Step 2 for `context`,
 * and `related`, `generating`, and `draft` all sit under its single "AI draft" stage.
 */
export type FlowStep =
  | "start"
  | "context"
  | "questions"
  | "related"
  | "generating"
  | "draft"
  | "confirmed";

/**
 * Requester identity. Name, email, and department are PII under the privacy guardrail: they stay
 * on this device, are never sent anywhere, and are clearable by the user.
 */
export interface RequesterIdentity {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
}

export function emptyIdentity(): RequesterIdentity {
  return { firstName: "", lastName: "", email: "", department: "" };
}

export function identityFullName(identity: RequesterIdentity): string {
  return `${identity.firstName} ${identity.lastName}`.trim();
}

/**
 * Attachment metadata only. File contents are deliberately not stored: base64 in localStorage
 * would blow the ~5MB quota on a single PDF and take the user's drafts down with it. The real
 * upload happens when Workfront submission goes live, against
 * `A3IntakeSupportingFiles`.
 */
export interface AttachmentRef {
  id: string;
  fileName: string;
  /** Bytes, as reported by the browser. */
  size: number;
  mimeType: string;
  addedAt: string;
}

/**
 * A compliance concern raised during intake. First-class from Sprint 1 because the Sprint 2
 * reviewer's gate path depends on whether a flag exists: an unflagged request skips the
 * Compliance gate entirely.
 */
export interface ComplianceFlag {
  id: string;
  /** Which guardrail heuristic fired. */
  rule: string;
  message: string;
  severity: "info" | "review";
  /** The question or field that triggered it. */
  sourceField: string;
  raisedAt: string;
  /** The requester may proceed with a flag attached; the flag travels with the brief. */
  acknowledged: boolean;
}

/** An answer to one registry question, keyed by question id rather than A3 field. */
export type AnswerMap = Record<string, string>;

export interface IntakeBrief {
  id: string;
  status: BriefStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;

  identity: RequesterIdentity;

  /** Free text from the Context step. Seeds the assistant and the matcher. */
  contextText: string;
  attachments: AttachmentRef[];

  /**
   * Captured only in the Context step's upload area, never as a guided question. Null means the
   * requester explicitly answered "None yet - new piece", which is different from unanswered.
   */
  alanNumber: string | null;
  /** Whether the ALAN question was answered at all, so "skipped" is distinguishable from "none". */
  alanAnswered: boolean;

  /** Raw answers keyed by question id. */
  answers: AnswerMap;

  /**
   * The question set this draft was started with, so a later registry change cannot retroactively
   * rewrite what was asked. A draft resumed after a change shows what it was asked.
   */
  questionSetVersion: number;
  questionIdsAsked: string[];

  /** Assembled A3 values, produced at the Generating step and editable at Review draft. */
  a3: A3Values;

  resolvedMatches: ResolvedMatch[];
  /**
   * What the matcher actually searched, captured at submit. Without this, a brief checked against
   * a single browser is indistinguishable from one checked against the whole Workfront queue.
   */
  matchCoverage: MatchCoverage | null;

  complianceFlags: ComplianceFlag[];

  /**
   * Which queue topic routes this request, as an id into the local queue config. Derived from the
   * team answer at the Generating step rather than asked as its own question.
   *
   * Null on every brief saved before queue topics existed, and on a brief that has not reached the
   * Generating step. The queue derives a topic for those from `A3IntakeCommunicationType` instead of
   * showing an empty Path, and says the route was derived - a brief that inferred its route is a
   * weaker claim than one that recorded it. See `queueTopicIdFor` in src/lib/workfront/routing.ts.
   */
  queueTopicId: string | null;

  /**
   * Local reviewer Status / Priority for the Mission Control queue. Not posted to Workfront yet.
   */
  reviewer: BriefReviewer;

  /**
   * Local stub (`mode: "local"`) or live Task create via the proxy (`mode: "workfront"`).
   * `issueId` / `issueUrl` hold the Workfront Task ID/URL after dual-write (keys kept for storage).
   */
  workfront: {
    mode: "local" | "workfront";
    issueName: string;
    submittedAt: string;
    issueId?: string;
    issueUrl?: string;
  } | null;
}

export function createBrief(partial: Partial<IntakeBrief> = {}): IntakeBrief {
  const now = new Date().toISOString();
  const { reviewer: partialReviewer, ...rest } = partial;
  return {
    id: crypto.randomUUID(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    identity: emptyIdentity(),
    contextText: "",
    attachments: [],
    alanNumber: null,
    alanAnswered: false,
    answers: {},
    questionSetVersion: 0,
    questionIdsAsked: [],
    a3: {},
    resolvedMatches: [],
    matchCoverage: null,
    complianceFlags: [],
    queueTopicId: null,
    workfront: null,
    ...rest,
    reviewer: {
      ...defaultReviewer(),
      ...(partialReviewer ?? {}),
    },
  };
}

/**
 * The one place a brief's status becomes a word.
 *
 * `BriefStatus` is persisted, so the stored values stay `draft` and `submitted`; renaming them would
 * need a migration for no gain. What changes is the label, and it changes in exactly one function
 * because three different screens render it: the Request Queue, the match cards built by
 * `briefToCorpusRecord`, and the confirmed screen. When those drifted apart, the app called one
 * state "Submitted" in a match card and "Ready to send" in the queue on the same afternoon.
 *
 * "Ready to send" rather than "Submitted" because nothing has been transmitted. Workfront's own
 * hard-coded status for the other case is literally "Draft", so that word is used as-is.
 */
export function briefStatusLabel(status: BriefStatus): string {
  return status === "submitted" ? "Ready to send" : "Draft";
}

/** A short label for lists and match cards. Never exposes the brief body. */
export function briefTitle(brief: IntakeBrief): string {
  const summary = brief.a3.A3IntakeProjectSummary?.trim();
  const context = brief.contextText.trim();
  const source = summary || context;
  if (!source) return "Untitled request";
  const firstSentence = source.split(/(?<=[.!?])\s/)[0] ?? source;
  return firstSentence.length > 80
    ? `${firstSentence.slice(0, 77).trimEnd()}...`
    : firstSentence;
}
