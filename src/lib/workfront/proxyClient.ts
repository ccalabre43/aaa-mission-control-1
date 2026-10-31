/**
 * Browser calls to the Workfront proxy (create / list Tasks, priority, portfolio).
 * Secrets stay on the proxy. HTTP path `/issues` remains for Task create/list (decision 036).
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

export interface WorkfrontUploadedDocument {
  ok: true;
  fileName: string;
  taskDocumentId?: string;
  projectDocumentId?: string;
  folderID?: string;
}

/** Cap matches the proxy (3 MB raw) so the UI fails early instead of after a large POST. */
export const WORKFRONT_DOC_MAX_BYTES = 3 * 1024 * 1024;

export interface WorkfrontPortfolioProject {
  ID: string;
  name: string;
  portfolioPriority: number | null;
  status: string | null;
}

export interface WorkfrontPortfolioListResult {
  ok: boolean;
  portfolioId?: string;
  count?: number;
  projects: WorkfrontPortfolioProject[];
  coverage: string;
  error?: string;
  endpoint: string;
}

export async function fetchPortfolioProjects(
  signal?: AbortSignal,
): Promise<WorkfrontPortfolioListResult> {
  const endpoint = `${proxyBaseUrl()}/portfolio`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: authHeaders(),
      signal,
      cache: "no-store",
    });
    const data = (await response.json()) as Record<string, unknown>;
    const projects = Array.isArray(data.projects)
      ? (data.projects as WorkfrontPortfolioProject[])
      : [];
    return {
      ok: data.ok === true,
      portfolioId:
        typeof data.portfolioId === "string" ? data.portfolioId : undefined,
      count: typeof data.count === "number" ? data.count : projects.length,
      projects,
      coverage:
        typeof data.coverage === "string"
          ? data.coverage
          : "Workfront portfolio project search result.",
      error: typeof data.error === "string" ? data.error : undefined,
      endpoint,
    };
  } catch (error) {
    return {
      ok: false,
      projects: [],
      coverage:
        "Workfront portfolio search failed. Executive order was not replaced.",
      error: error instanceof Error ? error.message : "Portfolio list failed.",
      endpoint,
    };
  }
}

export async function applyPortfolioOrder(input: {
  orderedProjectIds: string[];
  confirmLive: true;
}): Promise<
  | { ok: true; count: number; coverage: string }
  | { ok: false; error: string }
> {
  const endpoint = `${proxyBaseUrl()}/portfolio`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderedProjectIds: input.orderedProjectIds,
        confirmLive: input.confirmLive,
      }),
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (data.ok === true) {
      return {
        ok: true,
        count: typeof data.count === "number" ? data.count : input.orderedProjectIds.length,
        coverage:
          typeof data.coverage === "string"
            ? data.coverage
            : `Applied order for ${input.orderedProjectIds.length} projects.`,
      };
    }
    return {
      ok: false,
      error:
        typeof data.error === "string"
          ? data.error
          : `Portfolio order apply failed (HTTP ${response.status}).`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Portfolio order apply failed.",
    };
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file as data URL."));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads one file to a Workfront Task and mirrors it into project Documents > Tasks.
 * Secrets stay on the proxy; the browser only sends base64 over the same-origin/local proxy.
 */
export async function uploadWorkfrontDocument(input: {
  taskId: string;
  projectId: string;
  file: File;
  confirmLive: true;
}): Promise<WorkfrontUploadedDocument | { ok: false; error: string }> {
  const endpoint = `${proxyBaseUrl()}/documents`;
  if (input.file.size > WORKFRONT_DOC_MAX_BYTES) {
    return {
      ok: false,
      error: `"${input.file.name}" exceeds the ${WORKFRONT_DOC_MAX_BYTES} byte upload limit.`,
    };
  }
  try {
    const base64Data = await fileToBase64(input.file);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: input.taskId,
        projectId: input.projectId,
        fileName: input.file.name,
        mimeType: input.file.type || "application/octet-stream",
        base64Data,
        confirmLive: input.confirmLive,
      }),
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (data.ok === true) {
      return {
        ok: true,
        fileName:
          typeof data.fileName === "string" ? data.fileName : input.file.name,
        taskDocumentId:
          typeof data.taskDocumentId === "string" ? data.taskDocumentId : undefined,
        projectDocumentId:
          typeof data.projectDocumentId === "string"
            ? data.projectDocumentId
            : undefined,
        folderID: typeof data.folderID === "string" ? data.folderID : undefined,
      };
    }
    return {
      ok: false,
      error:
        typeof data.error === "string"
          ? data.error
          : `Document upload failed (HTTP ${response.status}).`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Document upload failed.",
    };
  }
}
