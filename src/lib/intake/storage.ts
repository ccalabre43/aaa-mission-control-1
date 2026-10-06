/**
 * Intake persistence, mirroring the discipline in src/lib/storage.ts: a primary key plus a backup,
 * quota messaging the user can act on, and a parse that repairs a record rather than rejecting it.
 *
 * A single unexpected value must never cost the user a brief, let alone all of them. There is no
 * server copy of any of this.
 */
import {
  BRIEF_BACKUP_KEY,
  BRIEF_STORAGE_KEY,
  IDENTITY_STORAGE_KEY,
  RECENT_ALAN_KEY,
  createBrief,
  defaultReviewer,
  emptyIdentity,
  type AnswerMap,
  type AttachmentRef,
  type BriefReviewer,
  type ComplianceFlag,
  type IntakeBrief,
  type RequesterIdentity,
  type ReviewerAssessmentLevel,
  type ReviewerPriority,
  type ReviewerStatus,
} from "./types";
import type { A3Values } from "./a3Schema";
import { isA3FieldName } from "./a3Schema";
import type { MatchCoverage, ResolvedMatch } from "../related/types";

export type LoadStatus = "ok" | "empty" | "recovered" | "unreadable";

export interface LoadResult {
  briefs: IntakeBrief[];
  status: LoadStatus;
}

export interface SaveResult {
  ok: boolean;
  reason?: string;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string): SaveResult {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (cause) {
    const quotaHit =
      cause instanceof DOMException &&
      (cause.name === "QuotaExceededError" ||
        cause.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      reason: quotaHit
        ? "This browser's storage is full, so the latest change was not saved. Submit or delete an older request to free up space."
        : "This browser is blocking local storage, so changes cannot be saved here.",
    };
  }
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function isoDateTime(value: unknown): string {
  const raw = text(value);
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => text(v)).filter(Boolean) : [];
}

function normalizeIdentity(value: unknown): RequesterIdentity {
  if (!value || typeof value !== "object") return emptyIdentity();
  const raw = value as Record<string, unknown>;
  return {
    firstName: text(raw.firstName),
    lastName: text(raw.lastName),
    email: text(raw.email),
    department: text(raw.department),
  };
}

function normalizeAnswers(value: unknown): AnswerMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: AnswerMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = text(raw);
  }
  return out;
}

/** Drops keys that are not real Workfront fields, so a stale draft cannot poison a payload. */
function normalizeA3(value: unknown): A3Values {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: A3Values = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (isA3FieldName(key)) out[key] = text(raw);
  }
  return out;
}

function normalizeAttachments(value: unknown): AttachmentRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const fileName = text(raw.fileName).trim();
    if (!fileName) return [];
    return [
      {
        id: text(raw.id).trim() || crypto.randomUUID(),
        fileName,
        size: typeof raw.size === "number" && raw.size >= 0 ? raw.size : 0,
        mimeType: text(raw.mimeType),
        addedAt: isoDateTime(raw.addedAt),
      },
    ];
  });
}

function normalizeFlags(value: unknown): ComplianceFlag[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const message = text(raw.message).trim();
    if (!message) return [];
    return [
      {
        id: text(raw.id).trim() || crypto.randomUUID(),
        rule: text(raw.rule),
        message,
        severity: raw.severity === "review" ? "review" : "info",
        sourceField: text(raw.sourceField),
        raisedAt: isoDateTime(raw.raisedAt),
        acknowledged: raw.acknowledged === true,
      },
    ];
  });
}

function normalizeResolvedMatches(value: unknown): ResolvedMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const recordId = text(raw.recordId).trim();
    if (!recordId) return [];
    const resolution = text(raw.resolution);
    return [
      {
        recordId,
        resolution:
          resolution === "duplicate" || resolution === "not-a-match"
            ? resolution
            : "related",
        classification:
          raw.classification === "duplicate" ||
          raw.classification === "overlap" ||
          raw.classification === "opportunity"
            ? raw.classification
            : "related",
        alanNumber: text(raw.alanNumber).trim() || null,
        title: text(raw.title),
        resolvedAt: isoDateTime(raw.resolvedAt),
      },
    ];
  });
}

/**
 * Coverage is only trusted when it round-trips completely. A partially-readable descriptor is
 * downgraded to null rather than guessed at: inventing `organization-wide` from damaged data
 * would be exactly the overclaim the guardrail forbids.
 */
function normalizeCoverage(value: unknown): MatchCoverage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const scope = text(raw.scope);
  if (scope !== "local-device" && scope !== "workfront-queue" && scope !== "hybrid") {
    return null;
  }
  const sources = Array.isArray(raw.sources)
    ? raw.sources.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const s = item as Record<string, unknown>;
        const label = text(s.label).trim();
        if (!label) return [];
        return [{ label, count: typeof s.count === "number" ? s.count : 0 }];
      })
    : [];
  return {
    scope,
    completeness:
      raw.completeness === "organization-wide" ? "organization-wide" : "partial",
    corpusSize: typeof raw.corpusSize === "number" ? raw.corpusSize : 0,
    sources,
    limitations: stringArray(raw.limitations),
    searchedAt: isoDateTime(raw.searchedAt),
  };
}

const REVIEWER_STATUS_VALUES: readonly ReviewerStatus[] = [
  "needs_review",
  "needs_clarification",
  "escalated",
  "approved",
  "closed",
  "deferred",
];

const REVIEWER_PRIORITY_VALUES: readonly ReviewerPriority[] = ["P1", "P2", "P3"];

const REVIEWER_ASSESSMENT_VALUES: readonly ReviewerAssessmentLevel[] = [
  "high",
  "medium",
  "low",
];

function normalizeAssessment(
  value: unknown,
  fallback: ReviewerAssessmentLevel,
): ReviewerAssessmentLevel {
  const raw = text(value).trim().toLowerCase();
  return REVIEWER_ASSESSMENT_VALUES.includes(raw as ReviewerAssessmentLevel)
    ? (raw as ReviewerAssessmentLevel)
    : fallback;
}

/** Repair-not-reject: unknown or missing reviewer data becomes the safe default. */
function normalizeReviewer(value: unknown): BriefReviewer {
  const defaults = defaultReviewer();
  if (!value || typeof value !== "object") return defaults;
  const raw = value as Record<string, unknown>;
  const statusRaw = text(raw.status).trim();
  const priorityRaw = text(raw.priority).trim();
  return {
    status: REVIEWER_STATUS_VALUES.includes(statusRaw as ReviewerStatus)
      ? (statusRaw as ReviewerStatus)
      : defaults.status,
    priority: REVIEWER_PRIORITY_VALUES.includes(priorityRaw as ReviewerPriority)
      ? (priorityRaw as ReviewerPriority)
      : defaults.priority,
    firstReviewedAt: text(raw.firstReviewedAt).trim()
      ? isoDateTime(raw.firstReviewedAt)
      : null,
    impact: normalizeAssessment(raw.impact, defaults.impact),
    effort: normalizeAssessment(raw.effort, defaults.effort),
    risk: normalizeAssessment(raw.risk, defaults.risk),
  };
}

function normalizeBrief(value: unknown): IntakeBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const alan = text(raw.alanNumber).trim();
  return createBrief({
    id: text(raw.id).trim() || crypto.randomUUID(),
    status: raw.status === "submitted" ? "submitted" : "draft",
    createdAt: isoDateTime(raw.createdAt),
    updatedAt: isoDateTime(raw.updatedAt),
    submittedAt: text(raw.submittedAt).trim() ? isoDateTime(raw.submittedAt) : null,
    identity: normalizeIdentity(raw.identity),
    contextText: text(raw.contextText),
    attachments: normalizeAttachments(raw.attachments),
    alanNumber: alan || null,
    alanAnswered: raw.alanAnswered === true,
    answers: normalizeAnswers(raw.answers),
    questionSetVersion:
      typeof raw.questionSetVersion === "number" ? raw.questionSetVersion : 0,
    questionIdsAsked: stringArray(raw.questionIdsAsked),
    a3: normalizeA3(raw.a3),
    resolvedMatches: normalizeResolvedMatches(raw.resolvedMatches),
    matchCoverage: normalizeCoverage(raw.matchCoverage),
    complianceFlags: normalizeFlags(raw.complianceFlags),
    // Absent on every brief saved before queue topics existed. Left null rather than guessed at
    // here: the queue derives a route at read time and labels it as derived, which storage cannot
    // do because it has no access to the queue config.
    queueTopicId: text(raw.queueTopicId).trim() || null,
    reviewer: normalizeReviewer(raw.reviewer),
    workfront:
      raw.workfront && typeof raw.workfront === "object"
        ? {
            mode: "local",
            issueName: text((raw.workfront as Record<string, unknown>).issueName),
            submittedAt: isoDateTime(
              (raw.workfront as Record<string, unknown>).submittedAt,
            ),
          }
        : null,
  });
}

function parseBriefs(rawValue: string | null): IntakeBrief[] | null {
  if (rawValue == null) return null;
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map(normalizeBrief)
      .filter((brief): brief is IntakeBrief => brief !== null);
  } catch {
    return null;
  }
}

export function loadBriefs(): LoadResult {
  const raw = readKey(BRIEF_STORAGE_KEY);
  const briefs = parseBriefs(raw);
  if (briefs) {
    return { briefs, status: briefs.length > 0 ? "ok" : "empty" };
  }
  const backup = parseBriefs(readKey(BRIEF_BACKUP_KEY));
  if (backup && backup.length > 0) {
    return { briefs: backup, status: "recovered" };
  }
  return { briefs: [], status: raw == null ? "empty" : "unreadable" };
}

export function saveBriefs(briefs: IntakeBrief[]): SaveResult {
  const payload = JSON.stringify(briefs);
  if (briefs.length > 0) writeKey(BRIEF_BACKUP_KEY, payload);
  return writeKey(BRIEF_STORAGE_KEY, payload);
}

export function upsertBrief(brief: IntakeBrief): SaveResult {
  const { briefs } = loadBriefs();
  const next = { ...brief, updatedAt: new Date().toISOString() };
  const index = briefs.findIndex((candidate) => candidate.id === brief.id);
  if (index >= 0) briefs[index] = next;
  else briefs.unshift(next);
  return saveBriefs(briefs);
}

export function deleteBrief(id: string): SaveResult {
  const { briefs } = loadBriefs();
  return saveBriefs(briefs.filter((brief) => brief.id !== id));
}

/** Identity persists so a repeat requester does not retype it. PII, and clearable. */
export function loadIdentity(): RequesterIdentity {
  const raw = readKey(IDENTITY_STORAGE_KEY);
  if (!raw) return emptyIdentity();
  try {
    return normalizeIdentity(JSON.parse(raw));
  } catch {
    return emptyIdentity();
  }
}

export function saveIdentity(identity: RequesterIdentity): SaveResult {
  return writeKey(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
}

/** Most recently used ALAN number, for pre-populating the combobox. */
export function loadRecentAlan(): string | null {
  return readKey(RECENT_ALAN_KEY)?.trim() || null;
}

export function saveRecentAlan(alanNumber: string): void {
  const trimmed = alanNumber.trim();
  if (trimmed) writeKey(RECENT_ALAN_KEY, trimmed);
}

/**
 * Clears the intake app's data from the device: saved briefs, the requester's identity, and the
 * remembered ALAN number. The identity is PII, which is the main reason this exists.
 *
 * Necessary once the app is hosted, because several people may share a machine on the same origin
 * and requester name and email would otherwise persist in the browser for whoever sits down next.
 *
 * Three keys are deliberately left alone, and none of the omissions is an oversight:
 *
 * - **`aaa-project-tracker`.** Those rows belong to the Request Queue's project tracker and are
 *   cleared by `clearTrackerData` from that screen. The control that calls this is labelled for
 *   requests specifically, so it cannot be read as clearing the tracker's rows too.
 * - **`aaa-intake-queue-config`.** Queue topics and routing rules are shared configuration, not one
 *   person's data. They contain no PII, and wiping them would silently unroute every future request
 *   on the machine - one requester clearing their own name would break intake for everyone who sits
 *   down next. Resetting the configuration belongs to the queue admin screen, which says so.
 * - **`aaa-dashboard-cards`.** The home dashboard's card layout is a display preference with no PII.
 *   Someone clearing their saved requests has not asked to have their dashboard rearranged.
 *   Resetting it belongs to the Add Tools dialog, which offers it explicitly.
 */
export function clearIntakeData(): void {
  for (const key of [
    BRIEF_STORAGE_KEY,
    BRIEF_BACKUP_KEY,
    IDENTITY_STORAGE_KEY,
    RECENT_ALAN_KEY,
  ]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing useful to do if storage is blocked */
    }
  }
}
