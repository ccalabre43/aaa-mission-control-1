/**
 * Turning saved briefs into the rows Workfront's Submitted Requests list would show.
 *
 * The column set is Workfront's, not an invention: Name, Converted to, Path, Status, Entry Date, Last
 * Update Date. Two Workfront columns are deliberately absent, and the reason matters more than the
 * omission:
 *
 * - **Ref #.** `referenceNumber` is assigned by Workfront when the issue is created. A locally
 *   generated one would be a fabricated identifier the UI then presents as fact, which guardrail 7
 *   forbids outright. Someone would eventually quote it to Workfront support.
 * - **Entered By.** Assigned server-side from the authenticated identity. See docs/workfront-auth.md
 *   for why that identity is not settled yet.
 *
 * `Converted to` is present but always empty. Workfront fills it when an issue becomes a project or
 * task, which is something only Workfront can do. It ships because a column that will be populated
 * later is honest, whereas a column that can never be populated is set dressing.
 */
import { briefStatusLabel, briefTitle, type IntakeBrief } from "../intake/types";
import type { QueueDef } from "./queueConfig";
import { pathLabel, routeFor, type RouteSource } from "./routing";
import { buildWorkfrontPayload, sendBlockers } from "./submitToWorkfront";

export interface QueueRow {
  briefId: string;
  /** The Workfront Issue name, from the real payload builder rather than rebuilt here. */
  name: string;
  /** Always empty. Workfront sets this when an issue is converted. */
  convertedTo: string;
  path: string;
  routeSource: RouteSource;
  status: string;
  /** ISO, or null for a draft that has not been submitted even locally. */
  entryDate: string | null;
  lastUpdateDate: string;
  isDraft: boolean;
  /**
   * Workfront calls an issue open when it has no Actual Completion Date. Nothing local can set one,
   * so every row is open. Kept as a field rather than hard-coded true so the Open filter becomes
   * correct on its own once a real completion date can arrive.
   */
  isOpen: boolean;
  /** Whether this row belongs to the person looking at the screen. */
  isMine: boolean;
  /** Name and department only. Never the email - guardrail 6. */
  requesterLabel: string;
  blockers: string[];
}

export type QueueColumn =
  | "name"
  | "convertedTo"
  | "path"
  | "status"
  | "entryDate"
  | "lastUpdateDate";

export interface ColumnDef {
  key: QueueColumn;
  label: string;
  sortable: boolean;
}

export const QUEUE_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", sortable: true },
  // Not sortable: sorting a column that is empty on every row would be a control that visibly does
  // nothing, which reads as a bug rather than as an empty column.
  { key: "convertedTo", label: "Converted to", sortable: false },
  { key: "path", label: "Path", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "entryDate", label: "Entry Date", sortable: true },
  { key: "lastUpdateDate", label: "Last Update Date", sortable: true },
];

/**
 * Workfront's own four filters on the Submitted Requests list, plus Drafts for work that never
 * reached submit.
 *
 * Drafts is separate rather than a fifth status because Workfront itself separates them: a draft
 * request is not in the submitted list at all. Folding them together would have shown a requester an
 * unfinished brief in a list they read as "things I have handed off".
 */
export type QueueFilter = "all" | "open" | "mine" | "mine-open" | "drafts";

export interface FilterDef {
  key: QueueFilter;
  label: string;
  /** Shown under the tabs, so a filter never silently changes what is on screen. */
  description: string;
}

export const QUEUE_FILTERS: FilterDef[] = [
  { key: "all", label: "All", description: "Every submitted request saved in this browser." },
  {
    key: "open",
    label: "Open",
    // Said out loud rather than quietly: two tabs showing identical results looks broken unless the
    // reason is stated. It will diverge the moment a completion date can exist.
    description:
      "Workfront counts a request as open until it has an Actual Completion Date. Nothing here can have one yet, so this currently matches All.",
  },
  { key: "mine", label: "My Requests", description: "Requests entered under your name." },
  {
    key: "mine-open",
    label: "My Open Requests",
    description: "Your requests that are still open.",
  },
  {
    key: "drafts",
    label: "Drafts",
    description:
      "Requests you started and have not submitted. Workfront keeps drafts out of the submitted list, and so does this.",
  },
];

export interface Viewer {
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Whether a brief belongs to the viewer.
 *
 * Email is the comparison key because two people can share a name, but it is only ever compared -
 * never displayed in a row. Matching on name alone would put someone else's request in your "My
 * Requests" tab, and on a shared browser that is a real disclosure.
 */
function isSameRequester(brief: IntakeBrief, viewer: Viewer): boolean {
  const briefEmail = brief.identity.email.trim().toLowerCase();
  const viewerEmail = viewer.email.trim().toLowerCase();
  if (briefEmail && viewerEmail) return briefEmail === viewerEmail;
  const briefName = `${brief.identity.firstName} ${brief.identity.lastName}`.trim().toLowerCase();
  const viewerName = `${viewer.firstName} ${viewer.lastName}`.trim().toLowerCase();
  return Boolean(briefName) && briefName === viewerName;
}

export function toQueueRow(
  brief: IntakeBrief,
  config: QueueDef,
  viewer: Viewer,
): QueueRow {
  const route = routeFor(config, brief);
  const isDraft = brief.status !== "submitted";

  return {
    briefId: brief.id,
    // Through the payload builder, so the Name column shows the exact string Workfront would show,
    // including the ALAN prefix and the 140-character truncation.
    name: buildWorkfrontPayload(brief, config).name || briefTitle(brief),
    convertedTo: "",
    path: pathLabel(route),
    routeSource: route.source,
    status: briefStatusLabel(brief.status),
    entryDate: brief.submittedAt,
    lastUpdateDate: brief.updatedAt,
    isDraft,
    isOpen: true,
    isMine: isSameRequester(brief, viewer),
    requesterLabel: [
      `${brief.identity.firstName} ${brief.identity.lastName}`.trim(),
      brief.identity.department,
    ]
      .filter(Boolean)
      .join(", "),
    blockers: sendBlockers(brief, config),
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
      // All means all submitted, matching Workfront's Submitted Requests list. Drafts have their
      // own tab.
      return rows.filter((row) => !row.isDraft);
  }
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  column: QueueColumn;
  direction: SortDirection;
}

/** Workfront's default on this list. */
export const DEFAULT_SORT: SortState = { column: "lastUpdateDate", direction: "desc" };

function sortValue(row: QueueRow, column: QueueColumn): string {
  switch (column) {
    case "name":
      return row.name.toLowerCase();
    case "convertedTo":
      return row.convertedTo;
    case "path":
      return row.path.toLowerCase();
    case "status":
      return row.status.toLowerCase();
    case "entryDate":
      // A draft has no entry date. Sorted to the end in both directions would need a separate
      // comparator; an empty string sorts first ascending, last descending, which reads correctly
      // either way for "not yet submitted".
      return row.entryDate ?? "";
    case "lastUpdateDate":
      return row.lastUpdateDate;
  }
}

export function sortQueueRows(rows: QueueRow[], sort: SortState): QueueRow[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const compared = sortValue(a, sort.column).localeCompare(sortValue(b, sort.column));
    // Ties broken by last update, descending, so the order is stable rather than dependent on the
    // order localeCompare happened to leave equal items in.
    if (compared !== 0) return compared * factor;
    return b.lastUpdateDate.localeCompare(a.lastUpdateDate);
  });
}

/** ARIA's word for a sort direction, for `aria-sort` on the header cell (4.1.2). */
export function ariaSortFor(
  column: QueueColumn,
  sort: SortState,
): "ascending" | "descending" | "none" {
  if (sort.column !== column) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

/** Short date for a table cell. Blank rather than a placeholder when there is nothing to show. */
export function formatQueueDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
