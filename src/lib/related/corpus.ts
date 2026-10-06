/**
 * Building the corpus the matcher searches.
 *
 * Kept separate from the matcher on purpose: the matcher takes its corpus as an argument, so
 * swapping in a Workfront-backed corpus later is a substitution rather than a rewrite.
 *
 * The privacy boundary lives here. A `CorpusRecord` carries no brief body, no attachment, and no
 * requester email, so a match card physically cannot leak them - the data never reaches the
 * component. `conceptText` exists for scoring only and is never rendered.
 */
import { briefStatusLabel, briefTitle, type IntakeBrief } from "../intake/types";
import type { TrackerRow } from "../types";
import type { CorpusRecord } from "./types";

const DELIVERABLE_TERMS = [
  "direct mail","postcard","brochure","flyer","email","landing page","microsite","banner",
  "display ad","digital ad","social","video","print","billboard","script","webinar","one-pager",
  "presentation","infographic","newsletter",
];

function findDeliverables(text: string): string[] {
  const lower = text.toLowerCase();
  return DELIVERABLE_TERMS.filter((term) => lower.includes(term));
}

/**
 * Concept text for scoring. Deliberately excludes the requester's name, email, and department: they
 * are PII and would also create false matches, since two unrelated requests from one person would
 * "match" on their own name.
 */
function briefConceptText(brief: IntakeBrief): string {
  return [
    brief.contextText,
    brief.a3.A3IntakeBackgroundPurpose,
    brief.a3.A3IntakeProjectSummary,
    brief.a3.A3IntakeDeliverables,
    brief.a3.A3IntakeGoalsExpectations,
    brief.a3.A3IntakeSuccessMeasurement,
    brief.a3.A3IntakeAdditionalInformation,
    brief.a3.A3IntakeSupplementalDescription,
  ]
    .filter(Boolean)
    .join(" ");
}

export function briefToCorpusRecord(brief: IntakeBrief): CorpusRecord {
  const conceptText = briefConceptText(brief);
  const deliverableText = brief.a3.A3IntakeDeliverables ?? "";
  return {
    id: brief.id,
    source: "brief",
    alanNumber: brief.alanNumber,
    title: briefTitle(brief),
    team: brief.identity.department,
    // Through the shared label, so a match card and the Request Queue cannot describe the same
    // request's state with different words.
    status: briefStatusLabel(brief.status),
    deadline: brief.a3.A3IntakeDesiredCompletionDate?.trim() || null,
    deliverables: findDeliverables(deliverableText || conceptText),
    createdAt: brief.createdAt,
    conceptText,
  };
}

/**
 * Tracker rows join the corpus because they represent real in-flight work. They carry no ALAN
 * number or team, so they can only ever match on concept, title, deadline, or deliverable type -
 * which is correct rather than a gap.
 */
export function trackerRowToCorpusRecord(row: TrackerRow): CorpusRecord {
  const conceptText = [row.project, row.nextSteps].filter(Boolean).join(" ");
  return {
    id: `tracker-${row.id}`,
    source: "tracker",
    alanNumber: null,
    title: row.project || "Untitled deliverable",
    team: "",
    status: row.status,
    deadline: row.estimatedCompletionDate,
    deliverables: findDeliverables(conceptText),
    createdAt: row.createdAt,
    conceptText,
  };
}

export function buildCorpus(
  briefs: IntakeBrief[],
  trackerRows: TrackerRow[],
  excludeBriefId?: string,
): CorpusRecord[] {
  const records: CorpusRecord[] = [];
  for (const brief of briefs) {
    if (brief.id === excludeBriefId) continue;
    // A brief with nothing in it yet would match everything on an empty-token comparison.
    if (!briefConceptText(brief).trim()) continue;
    records.push(briefToCorpusRecord(brief));
  }
  for (const row of trackerRows) {
    if (!row.project.trim() && !row.nextSteps.trim()) continue;
    records.push(trackerRowToCorpusRecord(row));
  }
  return records;
}
