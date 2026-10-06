/**
 * Turning saved briefs into reviewer-style Request Queue rows.
 *
 * Primary columns match the reviewer mock (Subject, Channels, Status, Priority, Entry Date,
 * Requestor). Workfront path, blockers, and send state remain on the row for the summary panel so
 * the Workfront connection is not lost. Reviewer Status/Priority are local until dual-write maps
 * them — see docs/knowledge/reviewer-queue-fields.md.
 */
import {
  briefTitle,
  reviewerStatusLabel,
  type IntakeBrief,
  type ReviewerPriority,
  type ReviewerStatus,
} from "../intake/types";
import type { QueueDef } from "./queueConfig";
import { pathLabel, routeFor, type RouteSource } from "./routing";
import { buildWorkfrontPayload, sendBlockers } from "./submitToWorkfront";

/** Known channel tokens for pill display; free-text leftovers still show as pills. */
const KNOWN_CHANNELS = [
  "Flyer",
  "Brochure",
  "Digital",
  "Direct Mail",
  "Social",
  "Email",
  "Print",
  "Video",
  "Web",
  "Landing page",
  "Postcard",
  "Newsletter",
] as const;

export interface QueueRow {
  briefId: string;
  /** Issue name / subject — same string Workfront would show. */
  name: string;
  channels: string[];
  reviewerStatus: ReviewerStatus;
  reviewerStatusLabel: string;
  priority: ReviewerPriority;
  /** ISO entry (submitted or created). */
  entryDate: string | null;
  lastUpdateDate: string;
  /** Display name only — never email (guardrail 6). */
  requesterName: string;
  requesterInitials: string;
  /** Department only when present; never email. */
  requesterDepartment: string;
  isNew: boolean;
  isDraft: boolean;
  /**
   * Open for filters: not closed, deferred, or approved (approved still leaves the "open intake"
   * path until Workfront completion exists; treated as done for Open filter).
   */
  isOpen: boolean;
  isMine: boolean;
  path: string;
  routeSource: RouteSource;
  blockers: string[];
  /** Local brief lifecycle label for summary. */
  briefLifecycleLabel: string;
}

export type QueueColumn =
  | "name"
  | "channels"
  | "reviewerStatus"
  | "priority"
  | "entryDate"
  | "requesterName";

export interface ColumnDef {
  key: QueueColumn;
  label: string;
  sortable: boolean;
}

export const QUEUE_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Subject", sortable: true },
  { key: "channels", label: "Channels", sortable: false },
  { key: "reviewerStatus", label: "Status", sortable: true },
  { key: "priority", label: "Priority", sortable: true },
  { key: "entryDate", label: "Entry Date", sortable: true },
  { key: "requesterName", label: "Requestor", sortable: true },
];

export type QueueFilter = "all" | "open" | "mine" | "mine-open" | "drafts";

export interface FilterDef {
  key: QueueFilter;
  label: string;
  description: string;
}

export const QUEUE_FILTERS: FilterDef[] = [
  {
    key: "all",
    label: "All",
    description: "Every request marked Ready to send and saved in this browser.",
  },
  {
    key: "open",
    label: "Open",
    description:
      "Ready-to-send requests whose local reviewer status is not Approved, Closed, or Deferred.",
  },
  { key: "mine", label: "My Requests", description: "Requests entered under your name." },
  {
    key: "mine-open",
    label: "My Open Requests",
    description: "Your open requests still in review.",
  },
  {
    key: "drafts",
    label: "Drafts",
    description:
      "Requests you started and have not marked Ready to send. Kept out of the main list, as Workfront keeps drafts out of Submitted Requests.",
  },
];

export interface Viewer {
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Split deliverables text into channel pills. Prefer known vocabulary; keep other tokens so free
 * text is not discarded.
 */
export function parseChannels(deliverables: string | undefined): string[] {
  const raw = (deliverables ?? "").trim();
  if (!raw) return [];

  const parts = raw
    .split(/[,;/|]+|\band\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  const found: string[] = [];
  const lowerKnown = KNOWN_CHANNELS.map((c) => c.toLowerCase());

  for (const part of parts) {
    const lower = part.toLowerCase();
    const knownIndex = lowerKnown.findIndex(
      (known) => known === lower || lower.includes(known),
    );
    if (knownIndex >= 0) {
      const label = KNOWN_CHANNELS[knownIndex];
      if (!found.includes(label)) found.push(label);
      continue;
    }
    // Title-case a short free-text token for a pill.
    const cleaned = part.replace(/\s+/g, " ");
    if (cleaned.length <= 40 && !found.includes(cleaned)) found.push(cleaned);
  }

  return found;
}

function requesterInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

function isSameRequester(brief: IntakeBrief, viewer: Viewer): boolean {
  const briefEmail = brief.identity.email.trim().toLowerCase();
  const viewerEmail = viewer.email.trim().toLowerCase();
  if (briefEmail && viewerEmail) return briefEmail === viewerEmail;
  const briefName = `${brief.identity.firstName} ${brief.identity.lastName}`.trim().toLowerCase();
  const viewerName = `${viewer.firstName} ${viewer.lastName}`.trim().toLowerCase();
  return Boolean(briefName) && briefName === viewerName;
}

function isReviewerOpen(status: ReviewerStatus): boolean {
  return status !== "approved" && status !== "closed" && status !== "deferred";
}

export function toQueueRow(
  brief: IntakeBrief,
  config: QueueDef,
  viewer: Viewer,
): QueueRow {
  const route = routeFor(config, brief);
  const isDraft = brief.status !== "submitted";
  const reviewer = brief.reviewer;
  const firstName = brief.identity.firstName.trim();
  const lastName = brief.identity.lastName.trim();
  const requesterName = `${firstName} ${lastName}`.trim() || "Unknown requestor";

  return {
    briefId: brief.id,
    name: buildWorkfrontPayload(brief, config).name || briefTitle(brief),
    channels: parseChannels(brief.a3.A3IntakeDeliverables),
    reviewerStatus: reviewer.status,
    reviewerStatusLabel: reviewerStatusLabel(reviewer.status),
    priority: reviewer.priority,
    entryDate: brief.submittedAt ?? brief.createdAt,
    lastUpdateDate: brief.updatedAt,
    requesterName,
    requesterInitials: requesterInitials(firstName, lastName),
    requesterDepartment: brief.identity.department.trim(),
    isNew: !isDraft && reviewer.firstReviewedAt == null,
    isDraft,
    isOpen: isReviewerOpen(reviewer.status),
    isMine: isSameRequester(brief, viewer),
    path: pathLabel(route),
    routeSource: route.source,
    blockers: sendBlockers(brief, config),
    briefLifecycleLabel: isDraft ? "Draft" : "Ready to send",
  };
}

export function filterRows(rows: QueueRow[], filter: QueueFilter): QueueRow[] {
  switch (filter) {
    case "drafts":
      return rows.filter((row) => row.isDraft);
    case "open":
      return rows.filter((row) => !row.isDraft && row.isOpen);
    case "mine":
      return rows.filter((row) => !row.isDraft && row.isMine);
    case "mine-open":
      return rows.filter((row) => !row.isDraft && row.isMine && row.isOpen);
    default:
      return rows.filter((row) => !row.isDraft);
  }
}

/** Search subject, requestor name, and channel tokens. */
export function searchRows(rows: QueueRow[], query: string): QueueRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    if (row.name.toLowerCase().includes(q)) return true;
    if (row.requesterName.toLowerCase().includes(q)) return true;
    if (row.channels.some((channel) => channel.toLowerCase().includes(q))) return true;
    if (row.reviewerStatusLabel.toLowerCase().includes(q)) return true;
    return false;
  });
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  column: QueueColumn;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { column: "entryDate", direction: "desc" };

function sortValue(row: QueueRow, column: QueueColumn): string {
  switch (column) {
    case "name":
      return row.name.toLowerCase();
    case "channels":
      return row.channels.join(" ").toLowerCase();
    case "reviewerStatus":
      return row.reviewerStatus;
    case "priority":
      return row.priority;
    case "entryDate":
      return row.entryDate ?? "";
    case "requesterName":
      return row.requesterName.toLowerCase();
  }
}

export function sortQueueRows(rows: QueueRow[], sort: SortState): QueueRow[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const compared = sortValue(a, sort.column).localeCompare(sortValue(b, sort.column));
    if (compared !== 0) return compared * factor;
    return b.lastUpdateDate.localeCompare(a.lastUpdateDate);
  });
}

export function ariaSortFor(
  column: QueueColumn,
  sort: SortState,
): "ascending" | "descending" | "none" {
  if (sort.column !== column) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

/** Entry Date column: MM/DD/YY with leading zeros, no time. */
export function formatQueueDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

/** Display-only Subject truncation for the queue table. Full title stays on the row. */
export function truncateWords(text: string, maxWords = 4): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}...`;
}
