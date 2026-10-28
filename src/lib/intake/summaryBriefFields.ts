/**
 * Concept v1 Summary brief-card values. Display-only: A3 first, then guided answers /
 * contextText when assemble never ran or optional fields were skipped.
 *
 * Does not invent A3 fields or change the Workfront payload.
 */
import type { IntakeBrief } from "./types";
import { parseChannels } from "../workfront/queueList";

export interface SummaryBriefField {
  label: string;
  value: string;
}

export interface SummaryBriefFields {
  left: SummaryBriefField[];
  right: SummaryBriefField[];
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
  const reviewFlags = brief.complianceFlags.filter((flag) => flag.severity === "review");
  if (reviewFlags.length === 0) return "Not specified in intake";
  return `Compliance review flagged: ${reviewFlags.map((flag) => flag.message).join("; ")}`;
}

function complianceNeedsReview(brief: IntakeBrief): string {
  return brief.complianceFlags.some((flag) => flag.severity === "review") ? "Yes" : "No";
}

/** Left / right columns for the Summary Concept v1 brief card. */
export function buildSummaryBriefFields(brief: IntakeBrief): SummaryBriefFields {
  return {
    left: [
      {
        label: "Business context",
        value: firstNonEmpty(
          brief.a3.A3IntakeBackgroundPurpose,
          answerFor(brief, "q-background"),
          brief.contextText,
        ),
      },
      { label: "Timing", value: timingValue(brief) },
      { label: "Approvals", value: approvalsValue(brief) },
      { label: "Channels / deliverable", value: channelsValue(brief) },
      {
        label: "What can we build from?",
        value: firstNonEmpty(
          brief.a3.A3IntakeAdditionalInformation,
          answerFor(brief, "q-anything-else"),
        ),
      },
      {
        label: "Any brand requirements?",
        value: firstNonEmpty(
          brief.a3.A3IntakeGoalsExpectations,
          answerFor(brief, "q-goals"),
        ),
      },
    ],
    right: [
      {
        label: "Audience",
        // No intake question or A3 audience field; do not misuse SupplementalDescription.
        value: "—",
      },
      {
        label: "Success metric",
        value: firstNonEmpty(
          brief.a3.A3IntakeSuccessMeasurement,
          answerFor(brief, "q-success"),
        ),
      },
      {
        label: "Compliance needs to review",
        value: complianceNeedsReview(brief),
      },
      {
        label: "What's the key message?",
        value: firstNonEmpty(
          brief.a3.A3IntakeProjectSummary,
          answerFor(brief, "q-summary"),
        ),
      },
      {
        label: "What support do you need?",
        value: "Not captured in intake",
      },
    ],
  };
}
