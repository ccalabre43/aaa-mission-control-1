/**
 * Illustrative Executive dashboard figures from A3 Creative Intake Concept v1
 * (Figma node 469-7289, “Executive dashboard 2”).
 *
 * Not Workfront Resource Planner data and not organization-wide (guardrail 7).
 * Queue counts and jobs in motion stay computed from this browser.
 */

export const EXEC_DEMO_SOURCE =
  "A3 Creative Intake Concept v1 (Figma node 469-7289)";

export const EXEC_DEMO_REPORTING_WEEK = "October 19 – October 23, 2026";

export const EXEC_DEMO_BUSY = {
  chip: "Busy",
  bookedPercent: 80,
  hoursCommitted: 192,
  hoursCapacity: 240,
  headcount: 8,
  caption:
    "192 of 240 hours committed this week across 8 writers and designers. Six-week trend shown at right. Illustrative Concept v1 figure — not Workfront.",
} as const;

export const EXEC_DEMO_CAPACITY = {
  chip: "Room to take work",
  hoursOpen: 48,
  caption:
    "Room for about 2 more standard jobs (~24 hrs each). Illustrative Concept v1 figure — not Workfront.",
  weeks: [
    { label: "This week", fillPercent: 80, percentLabel: "80%", emphasis: true },
    { label: "Wk 2", fillPercent: 70, percentLabel: "70%", emphasis: false },
    { label: "Wk 3", fillPercent: 55, percentLabel: "55%", emphasis: false },
    { label: "Wk 4", fillPercent: 38, percentLabel: "38%", emphasis: false },
  ],
} as const;

export const EXEC_DEMO_SPEED = {
  chip: "On target",
  daysAvg: "2.2",
  targetDays: 3,
  onTimePercent: 91,
  caption:
    "From request submitted to reviewer decision. Target is 3 days or less. Illustrative Concept v1 figure — not Workfront.",
} as const;

export interface ExecSelectedStatusRow {
  project: string;
  client: string;
  description: string;
  execReview: "Y" | "N";
  effort: string;
  owner: string;
  targetEnd: string;
  /** When mapped from a live escalated brief. */
  briefId?: string;
}

export interface ExecCompletedWorkRow {
  project: string;
  client: string;
  requestedDate: string;
  completedDate: string;
  owner: string;
  outcome: string;
}

/** Illustrative Selected status items (Figma 469-7289). Mandarin spelling corrected. */
export const EXEC_DEMO_SELECTED_STATUS: readonly ExecSelectedStatusRow[] = [
  {
    project: "Agent / Translations",
    client: "ACE, MWG, ACG",
    description:
      "Receive multiple requests to translate materials into various languages: Spanish, Mandarin, Arabic. Time to be set up with Betty/team to discuss.",
    execReview: "Y",
    effort: "Large (5 pts)",
    owner: "First, LastName",
    targetEnd: "29-Oct",
  },
  {
    project: "Test Data / FPO",
    client: "ACE, MWG, ACG",
    description:
      "Receive multiple requests to translate materials into various languages: Spanish, Mandarin, Arabic. Time to be set up with Betty/team to discuss.",
    execReview: "Y",
    effort: "Large (5 pts)",
    owner: "First, LastName",
    targetEnd: "29-Oct",
  },
];

/** Illustrative Completed work rows (Figma 469-7289 placeholders). */
export const EXEC_DEMO_COMPLETED_WORK: readonly ExecCompletedWorkRow[] = [
  {
    project: "Agent / Translations",
    client: "ACE, MWG, ACG",
    requestedDate: "00/00/2026",
    completedDate: "00/00/2026",
    owner: "First, LastName",
    outcome: "Notes here about outcome",
  },
  {
    project: "Test Data / FPO",
    client: "ACE, MWG, ACG",
    requestedDate: "00/00/2026",
    completedDate: "00/00/2026",
    owner: "First, LastName",
    outcome: "Notes here about outcome",
  },
  {
    project: "Test Data / FPO",
    client: "ACE, MWG, ACG",
    requestedDate: "00/00/2026",
    completedDate: "00/00/2026",
    owner: "First, LastName",
    outcome: "Notes here about outcome",
  },
  {
    project: "Test Data / FPO",
    client: "ACE, MWG, ACG",
    requestedDate: "00/00/2026",
    completedDate: "00/00/2026",
    owner: "First, LastName",
    outcome: "Notes here about outcome",
  },
  {
    project: "Test Data / FPO",
    client: "ACE, MWG, ACG",
    requestedDate: "00/00/2026",
    completedDate: "00/00/2026",
    owner: "First, LastName",
    outcome: "Notes here about outcome",
  },
];

export const EXEC_DEMO_COVERAGE =
  "Requests through the queue and jobs in motion use this browser’s saved briefs and project-tracker rows. Hours booked, capacity, turnaround, on-time %, reporting week, Selected status items (when not filled from escalations), and Completed work are illustrative Concept v1 figures (Figma node 469-7289), not a Workfront Resource Planner feed and not organization-wide.";
