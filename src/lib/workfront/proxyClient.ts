/**
 * Browser calls to the Workfront proxy (create / list Tasks). Secrets stay on the proxy.
 * HTTP path remains `/issues` for compatibility; Workfront object type is TASK (decision 036).
 */

import { workfrontHealthUrl } from "./proxyHealth";
import type { WorkfrontIssuePayload } from "./submitToWorkfront";
import { getWorkfrontUserBearer } from "./userBearer";

function proxyBaseUrl(): string {
  return workfrontHealthUrl().replace(/\/health\/?$/, "");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const bearer = getWorkfrontUserBearer();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  return headers;
}

export interface WorkfrontCreatedIssue {
  ok: true;
  ID: string;
  name: string;
  url: string;
  projectID: string;
}

export interface WorkfrontRemoteIssue {
  ID: string;
  name: string;
  status: string | null;
  priority: string | null;
  entryDate: string | null;
  queueTopicID: string | null;
  assignedToName: string | null;
  percentComplete: number | null;
}

export interface WorkfrontIssueListResult {
  ok: boolean;
  projectID?: string;
  count?: number;
  issues: WorkfrontRemoteIssue[];
  coverage: string;
  error?: string;
  endpoint: string;
}

export async function fetchWorkfrontIssues(
  signal?: AbortSignal,
): Promise<WorkfrontIssueListResult> {
  const endpoint = `${proxyBaseUrl()}/issues`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: authHeaders(),
      signal,
      cache: "no-store",
    });
    const data = (await response.json()) as Record<string, unknown>;
    const issues = Array.isArray(data.issues)
      ? (data.issues as WorkfrontRemoteIssue[])
      : [];
    return {
      ok: data.ok === true,
      projectID: typeof data.projectID === "string" ? data.projectID : undefined,
      count: typeof data.count === "number" ? data.count : issues.length,
      issues,
      coverage:
        typeof data.coverage === "string"
          ? data.coverage
          : "Workfront Task search result.",
      error: typeof data.error === "string" ? data.error : undefined,
      endpoint,
    };
  } catch (error) {
    return {
      ok: false,
      issues: [],
      coverage:
        "Workfront Task search failed. Showing local Request Queue rows only.",
      error: error instanceof Error ? error.message : "Task list failed.",
      endpoint,
    };
  }
}

export async function createWorkfrontIssue(
  payload: WorkfrontIssuePayload,
  options: { confirmLive: true },
): Promise<WorkfrontCreatedIssue | { ok: false; error: string }> {
  const endpoint = `${proxyBaseUrl()}/issues`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        confirmLive: options.confirmLive,
      }),
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (data.ok === true && typeof data.ID === "string" && data.ID) {
      return {
        ok: true,
        ID: data.ID,
        name: typeof data.name === "string" ? data.name : payload.name,
        url: typeof data.url === "string" ? data.url : "",
        projectID:
          typeof data.projectID === "string" ? data.projectID : payload.projectID,
      };
    }
    return {
      ok: false,
      error:
        typeof data.error === "string"
          ? data.error
          : `Task create failed (HTTP ${response.status}).`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Task create failed.",
    };
  }
}
