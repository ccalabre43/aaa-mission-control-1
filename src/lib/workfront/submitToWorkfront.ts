/**
 * Workfront submission adapter.
 *
 * Default path is local-only (Ready to send). Live dual-write requires the proxy kill switch
 * `WORKFRONT_LIVE_SUBMIT=1`, an explicit UI confirm (`confirmLive`), and a real Task ID back from
 * Workfront before `mode` becomes `"workfront"`. Secrets stay on the proxy — never in Vite.
 * Stored keys remain `issueId` / `issueUrl` (Task ID/URL) — decision 036.
 */
import {
  A3_SUBMITTED_FIELDS,
  isOptionField,
  isSingleValueField,
  parseOptionValues,
  validateA3,
  type A3Values,
} from "../intake/a3Schema";
import { briefTitle, type IntakeBrief } from "../intake/types";
import { describeCoverageForAudit } from "../related/coverage";
import { createWorkfrontIssue } from "./proxyClient";
import { pathLabel, routeExplanation, routeFor } from "./routing";
import { topicIsSubmittable, type QueueDef } from "./queueConfig";

export interface WorkfrontIssuePayload {
  /** Task name. Prefixed with the ALAN number when there is one, so a producer sees it. */
  name: string;
  description: string;
  /** From `A3IntakeDesiredCompletionDate`. ISO `YYYY-MM-DD`. */
  plannedCompletionDate: string | null;
  /** Keyed by internal Workfront field name. Passed through untranslated. */
  customForm: Record<string, string>;
  /** Names only. The real file upload is a separate Workfront document call. */
  attachmentNames: string[];

  /**
   * The queue topic. Empty until a Workfront admin supplies the real ID, which is what
   * `readyToSend` reports on. This is the field that puts the issue in the right place and fires its
   * routing rule; without it an issue would land in the queue unrouted.
   */
  queueTopicID: string;
  /** The queue's project. A request queue is a project in Workfront, hence a project ID. */
  projectID: string;
  /** A real Workfront Request Type, carried from the topic. */
  opTaskType: string;

  /*
   * Deliberately absent, and each for a reason worth keeping written down:
   *
   * - `referenceNumber` and `enteredByID` are assigned by Workfront when the issue is created. A
   *   locally invented value for either would be a fabrication the UI then displays as fact.
   * - `priority` has no requester-facing question, and the issue priority enum has not been verified
   *   against the API Explorer. Guessing 0-4 from the task object would be an assumption in a
   *   compliance-sensitive payload.
   */
}

export interface WorkfrontSubmitResult {
  mode: "local" | "workfront";
  issueName: string;
  issueId?: string;
  issueUrl?: string;
  payload: WorkfrontIssuePayload;
  /**
   * Whether this payload could actually be transmitted if a credential existed.
   *
   * Separate from `ok` on purpose. `ok` is about the requester's work being complete; this is about
   * the queue being configured. Conflating them would mean an unconfigured queue blocked people from
   * saving their own requests, which is a regression dressed up as a safety check.
   */
  readyToSend: boolean;
  /** Plain-language reasons transmission is not possible. Rendered to the user as-is. */
  blockers: string[];
  /** Set when a live attempt was made and the proxy or Workfront refused it. */
  liveError?: string;
}

const MAX_ISSUE_NAME = 140;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3).trimEnd()}...`;
}

/**
 * Audit lines prepended to the description.
 *
 * Nothing in the A3 schema carries an ALAN number or match-coverage information, and the app never
 * invents a Workfront field, so both ride in the description where a producer can at least read
 * them. Both are flagged as Workfront configuration requests in docs/decisions/decision-log.md - a
 * compliance identifier this load-bearing deserves a real custom field.
 *
 * The resolved Path is restated here for a different reason: `queueTopicID` is what actually routes
 * the issue, but it is an opaque ID, so a producer reading the description would have no way to tell
 * whether the request landed where the requester's answers said it should. The human-readable path
 * makes a mis-route visible instead of invisible.
 */
function auditLines(brief: IntakeBrief, config: QueueDef): string[] {
  const lines: string[] = [];

  const route = routeFor(config, brief);
  lines.push(`Queue path: ${pathLabel(route)} (${routeExplanation(route)})`);

  if (brief.alanNumber) {
    lines.push(`ALAN number: ${brief.alanNumber}`);
  } else if (brief.alanAnswered) {
    lines.push("ALAN number: none yet - new piece (confirmed by requester)");
  } else {
    lines.push("ALAN number: not provided");
  }

  lines.push(
    `Requested by: ${brief.identity.firstName} ${brief.identity.lastName} (${brief.identity.department})`.replace(
      /\s+/g,
      " ",
    ),
  );

  // Never let the absence of matches read as an organization-wide all-clear.
  lines.push(`Duplicate check: ${describeCoverageForAudit(brief.matchCoverage)}`);

  const duplicates = brief.resolvedMatches.filter(
    (match) => match.resolution === "duplicate",
  );
  const related = brief.resolvedMatches.filter(
    (match) => match.resolution === "related",
  );
  if (duplicates.length > 0) {
    lines.push(
      `Marked as duplicate of: ${duplicates
        .map((match) => match.alanNumber ?? match.title)
        .join(", ")}`,
    );
  }
  if (related.length > 0) {
    lines.push(
      `Related work: ${related.map((match) => match.alanNumber ?? match.title).join(", ")}`,
    );
  }

  const openFlags = brief.complianceFlags.filter((flag) => flag.severity === "review");
  if (openFlags.length > 0) {
    lines.push(
      `Compliance review requested: ${openFlags.map((flag) => flag.message).join("; ")}`,
    );
  }

  lines.push(...multiValueLines(brief.a3, route.topic?.name ?? null));

  return lines;
}

/**
 * Names every choice when a requester picked more than one on a field Workfront treats as
 * single-value.
 *
 * The app lets both teams be chosen because a request can genuinely need both, but the A3 form's
 * Communication Type is a radio and accepts one. Rather than guess which to drop, the full set is
 * submitted AND restated here, so a producer still sees the second team even if Workfront keeps
 * only the first. Converting that field to a checkbox group is an open configuration request in
 * docs/decisions/decision-log.md; until it lands, this line is the only record that survives.
 *
 * The wording names the topic that received the request rather than telling the reader to "treat
 * every option as in scope". The earlier wording predated queue topics and now contradicts them: a
 * multi-team answer routes to a single triage topic, so the request has exactly one owner on arrival,
 * and that owner's first job is to split or assign the work - not to assume both teams saw it.
 *
 * Driven off the schema, not a field name, so a second option field inherits it automatically.
 */
function multiValueLines(values: A3Values, topicName: string | null): string[] {
  const lines: string[] = [];
  for (const field of A3_SUBMITTED_FIELDS) {
    if (!isOptionField(field.name) || !isSingleValueField(field.name)) continue;
    const chosen = parseOptionValues(values[field.name], field.options);
    if (chosen.length < 2) continue;
    const routed = topicName
      ? `Routed to the "${topicName}" topic, which owns splitting or assigning the work.`
      : "No topic matched this combination, so nothing routed it - see the Queue path line above.";
    lines.push(
      `${field.label}: requester selected ${chosen.length} - ${chosen.join(", ")}. ` +
        `This Workfront field accepts one value, so only the first survives in the field itself. ${routed}`,
    );
  }
  return lines;
}

export function buildWorkfrontPayload(
  brief: IntakeBrief,
  config: QueueDef,
): WorkfrontIssuePayload {
  const customForm: Record<string, string> = {};
  for (const field of A3_SUBMITTED_FIELDS) {
    if (field.type === "attachment") continue;
    const value = (brief.a3[field.name] ?? "").trim();
    if (value) customForm[field.name] = value;
  }

  const summary = briefTitle(brief);
  const name = brief.alanNumber
    ? truncate(`${brief.alanNumber} - ${summary}`, MAX_ISSUE_NAME)
    : truncate(summary, MAX_ISSUE_NAME);

  const body = A3_SUBMITTED_FIELDS.filter(
    (field) => field.type !== "attachment" && (brief.a3[field.name] ?? "").trim(),
  )
    .map((field) => `${field.label}\n${(brief.a3[field.name] ?? "").trim()}`)
    .join("\n\n");

  const route = routeFor(config, brief);

  return {
    name,
    description: `${auditLines(brief, config).join("\n")}\n\n---\n\n${body}`,
    plannedCompletionDate: brief.a3.A3IntakeDesiredCompletionDate?.trim() || null,
    customForm,
    attachmentNames: brief.attachments.map((attachment) => attachment.fileName),
    queueTopicID: route.topic?.workfrontID ?? "",
    projectID: config.workfrontProjectID,
    opTaskType: route.topic?.requestType ?? "",
  };
}

/**
 * Why this payload could not be transmitted. Empty means queue config alone would allow a send.
 *
 * Live kill-switch and confirm are checked at submit time when `options.live` is set — they are not
 * listed here so Ready-to-send saves are not punished for an administrator's off switch.
 */
export function sendBlockers(brief: IntakeBrief, config: QueueDef): string[] {
  const blockers: string[] = [];
  const route = routeFor(config, brief);

  if (!route.topic) {
    blockers.push(
      "No queue topic matches this request's Communication Type, so nothing would route it.",
    );
  } else if (!route.topic.workfrontID.trim()) {
    blockers.push(
      `The queue topic "${route.topic.name}" has no Workfront queue topic ID yet.`,
    );
  }

  if (!config.workfrontProjectID.trim()) {
    blockers.push(
      `The queue "${config.name}" has no Workfront project ID yet. A request queue is a project in Workfront.`,
    );
  }

  return blockers;
}

/**
 * Display value under the Sent to Workfront label.
 * Affirmative " (WF Aligned)" is only returned with a real Task ID (copy-guard / decisions 035–036).
 * Storage key remains `issueId` for one release. Hover tooltips may still show the Task ID.
 */
export function workfrontSentDisplay(
  workfront: IntakeBrief["workfront"],
): { sent: boolean; label: string } {
  if (
    workfront?.mode === "workfront" &&
    typeof workfront.issueId === "string" &&
    workfront.issueId.trim()
  ) {
    return {
      sent: true,
      label: " (WF Aligned)",
    };
  }
  return { sent: false, label: "No" };
}

export interface WorkfrontSubmitError {
  ok: false;
  /** Required A3 fields with no value, named so the UI can point at them. */
  missingFields: string[];
}

export type WorkfrontSubmitOutcome =
  | ({ ok: true } & WorkfrontSubmitResult)
  | WorkfrontSubmitError;

export interface WorkfrontSubmitOptions {
  /**
   * When true, attempt proxy POST /issues after validation. Requires kill switch on the proxy and
   * `confirmLive: true`. Ready-to-send flows leave this false.
   */
  live?: boolean;
  /** Must be true for a live create. UI shows Entered By disclosure first. */
  confirmLive?: boolean;
}

/**
 * Validates against the real required fields, then saves locally and optionally dual-writes.
 *
 * `ok: false` means the requester still has work to do. An unconfigured queue is a different thing
 * and never produces `ok: false`: the request is saved and marked Ready to send, and `blockers`
 * carries what an administrator has to supply before anything could be transmitted.
 *
 * `mode: "workfront"` only when Workfront returns a real Task ID.
 */
export async function submitToWorkfront(
  brief: IntakeBrief,
  config: QueueDef,
  options: WorkfrontSubmitOptions = {},
): Promise<WorkfrontSubmitOutcome> {
  const validation = validateA3(brief.a3 as A3Values);
  if (!validation.valid) {
    return {
      ok: false,
      missingFields: validation.missing.map((field) => field.label),
    };
  }

  const payload = buildWorkfrontPayload(brief, config);
  const route = routeFor(config, brief);
  const blockers = sendBlockers(brief, config);
  const readyToSend =
    blockers.length === 0 && topicIsSubmittable(config, route.topic);

  if (!options.live) {
    return {
      ok: true,
      mode: "local",
      issueName: payload.name,
      payload,
      readyToSend,
      blockers,
    };
  }

  if (blockers.length > 0) {
    return {
      ok: true,
      mode: "local",
      issueName: payload.name,
      payload,
      readyToSend: false,
      blockers,
      liveError: blockers[0],
    };
  }

  if (options.confirmLive !== true) {
    return {
      ok: true,
      mode: "local",
      issueName: payload.name,
      payload,
      readyToSend,
      blockers: [
        ...blockers,
        "Live send needs confirmation of who Entered By will be (signed-in user or integration account).",
      ],
      liveError: "confirmLive was not true.",
    };
  }

  const created = await createWorkfrontIssue(payload, { confirmLive: true });
  if (!created.ok) {
    return {
      ok: true,
      mode: "local",
      issueName: payload.name,
      payload,
      readyToSend,
      blockers: [...blockers, created.error],
      liveError: created.error,
    };
  }

  return {
    ok: true,
    mode: "workfront",
    issueName: created.name || payload.name,
    issueId: created.ID,
    issueUrl: created.url || undefined,
    payload,
    readyToSend: true,
    blockers: [],
  };
}
