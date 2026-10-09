/**
 * Client-side health check against the Workfront proxy.
 *
 * The browser never holds client_secret. It calls either:
 * - same-origin `/api/workfront/health` (Vite proxies to the local Runtime stand-in), or
 * - an absolute `WORKFRONT_PROXY_URL` baked at build time (non-`VITE_` define).
 * When ExC Shell supplies an IMS user Bearer, that is sent on the request (Path A).
 */

import { getWorkfrontUserBearer } from "./userBearer";

export interface WorkfrontProxyProject {
  ID: string;
  name: string;
}

export interface WorkfrontProxyHealth {
  connected: boolean;
  project?: WorkfrontProxyProject;
  auth?: "client_credentials" | "access_token" | "bearer";
  host?: string;
  error?: string;
  /**
   * Proxy kill switch (`WORKFRONT_LIVE_SUBMIT=1`). Connected health can be true while this is false.
   */
  liveSubmit: boolean;
  /** Where the client called. Named so a negative result is auditable (guardrail 7). */
  endpoint: string;
}

declare const __WORKFRONT_PROXY_URL__: string;

function proxyBaseUrl(): string {
  const configured =
    typeof __WORKFRONT_PROXY_URL__ === "string" ? __WORKFRONT_PROXY_URL__.trim() : "";
  if (configured) return configured.replace(/\/+$/, "");
  // Dev / same-origin: Vite (or a host reverse proxy) forwards this to the Runtime action.
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return `${base}/api/workfront`;
}

export function workfrontHealthUrl(): string {
  return `${proxyBaseUrl()}/health`;
}

/**
 * Returns connection state. Never throws — a failed fetch is `connected: false` with a reason.
 */
export async function fetchWorkfrontHealth(
  signal?: AbortSignal,
): Promise<WorkfrontProxyHealth> {
  const endpoint = workfrontHealthUrl();
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const bearer = getWorkfrontUserBearer();
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }
    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      signal,
      cache: "no-store",
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        connected: false,
        liveSubmit: false,
        endpoint,
        error: `Proxy returned non-JSON (HTTP ${response.status}).`,
      };
    }

    const projectRaw = data.project;
    const project =
      projectRaw &&
      typeof projectRaw === "object" &&
      typeof (projectRaw as WorkfrontProxyProject).ID === "string" &&
      typeof (projectRaw as WorkfrontProxyProject).name === "string"
        ? (projectRaw as WorkfrontProxyProject)
        : undefined;

    const connected = data.connected === true && Boolean(project);
    return {
      connected,
      project,
      auth:
        data.auth === "client_credentials" ||
        data.auth === "access_token" ||
        data.auth === "bearer"
          ? data.auth
          : undefined,
      host: typeof data.host === "string" ? data.host : undefined,
      liveSubmit: data.liveSubmit === true,
      error:
        typeof data.error === "string"
          ? data.error
          : connected
            ? undefined
            : `Proxy reported not connected (HTTP ${response.status}).`,
      endpoint,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Health check was cancelled."
        : error instanceof Error
          ? error.message
          : "Health check failed.";
    return {
      connected: false,
      liveSubmit: false,
      endpoint,
      error: message,
    };
  }
}
