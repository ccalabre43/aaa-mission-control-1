/**
 * Upsert Workfront Task summaries into local Request Queue briefs.
 *
 * Match by Task ID, then exact Task name. On conflict Workfront wins for surface fields.
 * Local briefs with no matching Task are kept. Never stores requester email.
 */

import { ALAN_SEARCH_PATTERN } from "../intake/alanNumber";
import {
  briefTitle,
  createBrief,
  type IntakeBrief,
  type RequesterIdentity,
  type ReviewerPriority,
  type ReviewerStatus,
} from "../intake/types";
import type { WorkfrontRemoteIssue } from "./proxyClient";

const DEFAULT_HOST = "https://aaalife.my.workfront.com";

export interface MergeRemoteTasksResult {
  briefs: IntakeBrief[];
  added: number;
  updated: number;
  linked: number;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function taskUrl(taskId: string, host = DEFAULT_HOST): string {
  const base = host.replace(/\/+$/, "");
  return `${base}/task/view?ID=${encodeURIComponent(taskId)}`;
}

/** Leading ALAN from a Task name (e.g. `ALAN-29541-624-00 - Flyer`). */
export function parseAlanFromTaskName(name: string): string | null {
  const match = name.trim().match(new RegExp(`^${ALAN_SEARCH_PATTERN.source}`, "i"));
  return match ? match[0].toUpperCase() : null;
}

function summaryFromTaskName(name: string, alan: string | null): string {
  const trimmed = name.trim();
  if (!alan) return trimmed || "Untitled request";
  const without = trimmed
    .replace(new RegExp(`^${alan}\\s*[-–—:]?\\s*`, "i"), "")
    .trim();
  return without || trimmed;
}

/**
 * Best-effort map of Workfront Task status → local reviewer status.
 * Unrecognized values return null (caller keeps existing / defaults on create).
 */
export function mapWorkfrontStatus(raw: string | null): ReviewerStatus | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (
    key === "cls" ||
    key.includes("complete") ||
    key.includes("closed") ||
    key === "cpl" ||
    key.includes("done")
  ) {
    return "closed";
  }
  if (key.includes("defer") || key.includes("hold") || key.includes("backlog")) {
    return "deferred";
  }
  if (key.includes("approv") || key === "app") {
    return "approved";
  }
  if (key.includes("escalat") || key.includes("urgent")) {
    return "escalated";
  }
  if (
    key.includes("clarif") ||
    key.includes("info") ||
    key.includes("waiting") ||
    key.includes("on hold")
  ) {
    return "needs_clarification";
  }
  if (
    key.includes("new") ||
    key.includes("in progress") ||
    key.includes("working") ||
    key === "inp" ||
    key.includes("review")
  ) {
    return "needs_review";
  }
  return null;
}

/**
 * Workfront priority is often numeric (1–9) or Urgent/High/Normal/Low.
 * Unrecognized → null.
 */
export function mapWorkfrontPriority(raw: string | null): ReviewerPriority | null {
  if (raw == null || String(raw).trim() === "") return null;
  const key = String(raw).trim().toLowerCase();
  if (key === "1" || key === "2" || key.includes("urgent") || key.includes("highest")) {
    return "P1";
  }
  if (key === "3" || key.includes("high")) {
    return "P1";
  }
  if (key === "4" || key === "5" || key.includes("normal") || key.includes("medium")) {
    return "P2";
  }
  if (
    key === "6" ||
    key === "7" ||
    key === "8" ||
    key === "9" ||
    key.includes("low")
  ) {
    return "P3";
  }
  return null;
}

/** Split "Chris Calabrese" into first/last; never invent email. */
export function identityFromAssignedName(
  assignedToName: string | null,
  previous?: RequesterIdentity,
): RequesterIdentity {
  const base = previous ?? {
    firstName: "",
    lastName: "",
    email: "",
    department: "",
  };
  const name = assignedToName?.trim();
  if (!name) return base;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return base;
  if (parts.length === 1) {
    return { ...base, firstName: parts[0], lastName: "", email: base.email };
  }
  return {
    ...base,
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    email: base.email,
  };
}

function briefMatchNames(brief: IntakeBrief): string[] {
  const names: string[] = [];
  const issueName = brief.workfront?.issueName?.trim();
  if (issueName) names.push(issueName);
  const summary = brief.a3.A3IntakeProjectSummary?.trim();
  if (summary) names.push(summary);
  const title = briefTitle(brief);
  if (title && title !== "Untitled request") names.push(title);
  return names;
}

function findMatchIndex(
  briefs: IntakeBrief[],
  task: WorkfrontRemoteIssue,
  claimed: Set<number>,
): number {
  const id = task.ID.trim();
  for (let i = 0; i < briefs.length; i++) {
    if (claimed.has(i)) continue;
    const issueId = briefs[i].workfront?.issueId?.trim();
    if (issueId && issueId === id) return i;
  }

  const taskName = normalizeName(task.name || "");
  if (!taskName) return -1;
  for (let i = 0; i < briefs.length; i++) {
    if (claimed.has(i)) continue;
    const existingId = briefs[i].workfront?.issueId?.trim();
    if (existingId && existingId !== id) continue;
    for (const candidate of briefMatchNames(briefs[i])) {
      if (normalizeName(candidate) === taskName) return i;
    }
  }
  return -1;
}

function applyWorkfrontSurface(
  brief: IntakeBrief,
  task: WorkfrontRemoteIssue,
  now: string,
): IntakeBrief {
  const name = (task.name || brief.workfront?.issueName || briefTitle(brief)).trim();
  const alan = parseAlanFromTaskName(name);
  const summary = summaryFromTaskName(name, alan);
  const mappedStatus = mapWorkfrontStatus(task.status);
  const mappedPriority = mapWorkfrontPriority(task.priority);
  const entry =
    task.entryDate?.trim() || brief.submittedAt || brief.createdAt || now;

  return {
    ...brief,
    status: "submitted",
    updatedAt: now,
    submittedAt: brief.submittedAt ?? entry,
    alanNumber: alan ?? brief.alanNumber,
    alanAnswered: Boolean(alan) || brief.alanAnswered,
    a3: {
      ...brief.a3,
      A3IntakeProjectSummary: summary || brief.a3.A3IntakeProjectSummary || name,
    },
    identity: identityFromAssignedName(task.assignedToName, brief.identity),
    reviewer: {
      ...brief.reviewer,
      ...(mappedStatus ? { status: mappedStatus } : {}),
      ...(mappedPriority ? { priority: mappedPriority } : {}),
    },
    workfront: {
      mode: "workfront",
      issueName: name || "Untitled task",
      submittedAt: entry,
      issueId: task.ID.trim(),
      issueUrl: taskUrl(task.ID.trim()),
    },
  };
}

function createBriefFromTask(task: WorkfrontRemoteIssue, now: string): IntakeBrief {
  const name = (task.name || "").trim() || "Untitled task";
  const alan = parseAlanFromTaskName(name);
  const summary = summaryFromTaskName(name, alan);
  const entry = task.entryDate?.trim() || now;
  return createBrief({
    status: "submitted",
    createdAt: entry,
    updatedAt: now,
    submittedAt: entry,
    alanNumber: alan,
    alanAnswered: Boolean(alan),
    a3: { A3IntakeProjectSummary: summary },
    identity: identityFromAssignedName(task.assignedToName),
    matchCoverage: {
      scope: "workfront-queue",
      completeness: "partial",
      corpusSize: 1,
      sources: [
        {
          label: "Workfront Tasks on mission-control-v1 (summary fields)",
          count: 1,
        },
      ],
      limitations: [
        "Created from a Workfront Task list refresh (summary fields only). Not a full A3 intake and not organization-wide.",
      ],
      searchedAt: now,
    },
    reviewer: {
      status: mapWorkfrontStatus(task.status) ?? "needs_review",
      priority: mapWorkfrontPriority(task.priority) ?? "P3",
      firstReviewedAt: null,
      impact: "medium",
      effort: "medium",
      risk: "low",
    },
    workfront: {
      mode: "workfront",
      issueName: name,
      submittedAt: entry,
      issueId: task.ID.trim(),
      issueUrl: taskUrl(task.ID.trim()),
    },
  });
}

/**
 * Pure merge: returns a new briefs array. Does not delete local-only briefs.
 */
export function mergeRemoteTasksIntoBriefs(
  briefs: IntakeBrief[],
  remoteIssues: WorkfrontRemoteIssue[],
  now = new Date().toISOString(),
): MergeRemoteTasksResult {
  const next = briefs.map((brief) => ({ ...brief }));
  const claimed = new Set<number>();
  const created: IntakeBrief[] = [];
  let added = 0;
  let updated = 0;
  let linked = 0;

  for (const task of remoteIssues) {
    const id = task.ID?.trim();
    if (!id) continue;

    const index = findMatchIndex(next, task, claimed);
    if (index >= 0) {
      claimed.add(index);
      next[index] = applyWorkfrontSurface(next[index], task, now);
      updated += 1;
      linked += 1;
    } else {
      created.push(createBriefFromTask(task, now));
      added += 1;
      linked += 1;
    }
  }

  return { briefs: [...created, ...next], added, updated, linked };
}
