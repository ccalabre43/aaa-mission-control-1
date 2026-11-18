/**
 * Concept v1 Summary brief-card values and edit targets.
 *
 * Display prefers A3, then guided answers / contextText / summary-* answer keys.
 * Non-schema rows (Approvals, Audience, Support) persist in `brief.answers` and ride
 * Overview Description audit lines on send — never invent Workfront fields.
 */
import type { A3FieldName } from "./a3Schema";
import type { IntakeBrief } from "./types";
import { parseChannels } from "../workfront/queueList";

export const SUMMARY_APPROVALS_KEY = "summary-approvals";
export const SUMMARY_AUDIENCE_KEY = "summary-audience";
export const SUMMARY_SUPPORT_KEY = "summary-support";
export const SUMMARY_COMPLIANCE_KEY = "summary-compliance-review";

export type SummaryFieldId =
  | "business-context"
  | "timing"
  | "approvals"
  | "channels"
  | "build-from"
  | "brand"
  | "audience"
  | "success"
  | "compliance"
  | "key-message"
  | "support";

export type SummaryEditKind = "textarea" | "yesno";

export type SummaryPersistTarget =
  | { kind: "a3"; field: A3FieldName }
  | { kind: "answer"; key: string }
  | { kind: "compliance" };

export interface SummaryBriefField {
  id: SummaryFieldId;
  label: string;
  value: string;
  editKind: SummaryEditKind;
  persist: SummaryPersistTarget;
  /** Left column vs right column in the Concept v1 two-column card. */
  column: "left" | "right";
  /** Brand requirements spans full width under the two columns. */
  fullWidth?: boolean;
}

function trim(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function firstNonEmpty(...parts: Array<string | undefined | null>): string {
  for (const part of parts) {
    const next = trim(part);
    if (next) return next;
  }
  return "—";
}

function answerFor(brief: IntakeBrief, questionId: string): string {
  return trim(brief.answers[questionId]);
}

function timingValue(brief: IntakeBrief): string {
  const a3Notes = trim(brief.a3.A3IntakeTimingNotes);
  const a3Date = trim(brief.a3.A3IntakeDesiredCompletionDate);
  const a3Parts = [
    a3Notes,
    a3Date ? `Desired completion: ${a3Date}` : "",
  ].filter(Boolean);
  if (a3Parts.length > 0) return a3Parts.join(" ");

  const answerNotes = answerFor(brief, "q-timing");
  const answerDate = answerFor(brief, "q-deadline");
  const answerParts = [
    answerNotes,
    answerDate ? `Desired completion: ${answerDate}` : "",
  ].filter(Boolean);
  return answerParts.length > 0 ? answerParts.join(" ") : "—";
}

function channelsValue(brief: IntakeBrief): string {
  const fromA3 = trim(brief.a3.A3IntakeDeliverables);
  const channels = parseChannels(fromA3);
  if (channels.length > 0) return channels.join(", ");
  if (fromA3) return fromA3;
  return firstNonEmpty(answerFor(brief, "q-deliverables"));
}

function approvalsValue(brief: IntakeBrief): string {
  const edited = answerFor(brief, SUMMARY_APPROVALS_KEY);
  if (edited) return edited;
  const reviewFlags = brief.complianceFlags.filter((flag) => flag.severity === "review");
  if (reviewFlags.length === 0) return "Not specified in intake";
  return `Compliance review flagged: ${reviewFlags.map((flag) => flag.message).join("; ")}`;
}

function complianceNeedsReview(brief: IntakeBrief): string {
  const override = answerFor(brief, SUMMARY_COMPLIANCE_KEY);
  if (override === "Yes" || override === "No") return override;
  return brief.complianceFlags.some((flag) => flag.severity === "review") ? "Yes" : "No";
}

/** Ordered rows for the Summary Concept v1 Project Summary card. */
export function buildSummaryBriefFields(brief: IntakeBrief): SummaryBriefField[] {
  return [
    {
      id: "business-context",
      label: "Business context",
      column: "left",
      editKind: "textarea",
      persist: { kind: "a3", field: "A3IntakeBackgroundPurpose" },
      value: firstNonEmpty(
        brief.a3.A3IntakeBackgroundPurpose,
        answerFor(brief, "q-background"),
        brief.contextText,
      ),
    },
    {
      id: "audience",
      label: "Audience",
      column: "right",
      editKind: "textarea",
      persist: { kind: "answer", key: SUMMARY_AUDIENCE_KEY },
      value: firstNonEmpty(answerFor(brief, SUMMARY_AUDIENCE_KEY)),
    },
    {
      id: "timing",
      label: "Timing",
      column: "left",
      editKind: "textarea",
      persist: { kind: "a3", field: "A3IntakeTimingNotes" },
      value: timingValue(brief),
    },
    {
      id: "success",
      label: "Success metric",
      column: "right",
      editKind: "textarea",
      persist: { kind: "a3", field: "A3IntakeSuccessMeasurement" },
      value: firstNonEmpty(
        brief.a3.A3IntakeSuccessMeasurement,
        answerFor(brief, "q-success"),
      ),
    },
    {
      id: "approvals",
      label: "Approvals",
      column: "left",
      editKind: "textarea",
      persist: { kind: "answer", key: SUMMARY_APPROVALS_KEY },
      value: approvalsValue(brief),
    },
    {
      id: "compliance",
      label: "Compliance needs to review",
      column: "right",
      editKind: "yesno",
      persist: { kind: "compliance" },
      value: complianceNeedsReview(brief),
    },
    {
      id: "channels",
      label: "Channels / deliverable",
      column: "left",
      editKind: "textarea",
      persist: { kind: "a3", field: "A3IntakeDeliverables" },
      value: channelsValue(brief),
    },
    {
      id: "key-message",
      label: "What's the key message?",
      column: "right",
      editKind: "textarea",
      persist: { kind: "a3", field: "A3IntakeProjectSummary" },
      value: firstNonEmpty(
        brief.a3.A3IntakeProjectSummary,
        answerFor(brief, "q-summary"),
      ),
    },
    {
      id: "build-from",
      label: "What can we build from?",
      column: "left",
      editKind: "textarea",
      persist: { kind: "a3", field: "A3IntakeAdditionalInformation" },
      value: firstNonEmpty(
        brief.a3.A3IntakeAdditionalInformation,
        answerFor(brief, "q-anything-else"),
      ),
    },
    {
      id: "support",
      label: "What support do you need?",
      column: "right",
      editKind: "textarea",
      persist: { kind: "answer", key: SUMMARY_SUPPORT_KEY },
      value: firstNonEmpty(
        answerFor(brief, SUMMARY_SUPPORT_KEY),
        "Not captured in intake",
      ),
    },
    {
      id: "brand",
      label: "Any brand requirements?",
      column: "left",
      fullWidth: true,
      editKind: "textarea",
      persist: { kind: "a3", field: "A3IntakeGoalsExpectations" },
      value: firstNonEmpty(
        brief.a3.A3IntakeGoalsExpectations,
        answerFor(brief, "q-goals"),
      ),
    },
  ];
}

/** Left / right column split for layout (excludes fullWidth rows). */
export function partitionSummaryFields(fields: SummaryBriefField[]): {
  left: SummaryBriefField[];
  right: SummaryBriefField[];
  fullWidth: SummaryBriefField[];
} {
  return {
    left: fields.filter((field) => field.column === "left" && !field.fullWidth),
    right: fields.filter((field) => field.column === "right" && !field.fullWidth),
    fullWidth: fields.filter((field) => field.fullWidth),
  };
}

/**
 * Apply an edited summary value onto a brief. Returns a new brief object.
 * Display placeholders like "—" are stored as empty strings.
 */
export function applySummaryFieldEdit(
  brief: IntakeBrief,
  field: SummaryBriefField,
  rawValue: string,
): IntakeBrief {
  const value = rawValue.trim() === "—" ? "" : rawValue.trim();
  const updatedAt = new Date().toISOString();

  if (field.persist.kind === "a3") {
    return {
      ...brief,
      updatedAt,
      a3: {
        ...brief.a3,
        [field.persist.field]: value,
      },
    };
  }

  if (field.persist.kind === "answer") {
    return {
      ...brief,
      updatedAt,
      answers: {
        ...brief.answers,
        [field.persist.key]: value,
      },
    };
  }

  // Compliance Yes/No
  const wantsReview = value === "Yes";
  let complianceFlags = brief.complianceFlags.filter(
    (flag) => flag.rule !== "summary-compliance-review",
  );
  if (wantsReview) {
    const hasReview = complianceFlags.some((flag) => flag.severity === "review");
    if (!hasReview) {
      complianceFlags = [
        ...complianceFlags,
        {
          id: crypto.randomUUID(),
          rule: "summary-compliance-review",
          message: "Compliance review requested from the request summary.",
          severity: "review" as const,
          sourceField: "summary-compliance-review",
          raisedAt: updatedAt,
          acknowledged: true,
        },
      ];
    }
  } else {
    complianceFlags = complianceFlags.filter((flag) => flag.severity !== "review");
  }

  return {
    ...brief,
    updatedAt,
    complianceFlags,
    answers: {
      ...brief.answers,
      [SUMMARY_COMPLIANCE_KEY]: wantsReview ? "Yes" : "No",
    },
  };
}

/** Labeled Overview Description lines for non-A3 summary edits (Workfront config requests). */
export function summaryAuditLines(brief: IntakeBrief): string[] {
  const lines: string[] = [];
  const approvals = answerFor(brief, SUMMARY_APPROVALS_KEY);
  if (approvals) {
    lines.push(
      `Approvals (summary; no A3 field — Workfront configuration request): ${approvals}`,
    );
  }
  const audience = answerFor(brief, SUMMARY_AUDIENCE_KEY);
  if (audience) {
    lines.push(
      `Audience (summary; no A3 field — Workfront configuration request): ${audience}`,
    );
  }
  const support = answerFor(brief, SUMMARY_SUPPORT_KEY);
  if (support) {
    lines.push(
      `What support do you need? (summary; no A3 field — Workfront configuration request): ${support}`,
    );
  }
  return lines;
}
