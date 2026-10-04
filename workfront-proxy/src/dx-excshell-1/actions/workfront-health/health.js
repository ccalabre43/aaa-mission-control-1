/**
 * Shared Workfront health check for the App Builder Runtime action and the local proxy.
 *
 * Reads credentials from the environment (Runtime secrets or a gitignored local .env), exchanges
 * client credentials for an IMS token when a secret is present, then GETs the queue project.
 * The response never includes tokens or secrets.
 *
 * On corp laptops Node's CA store sometimes lacks the TLS intercept root that curl already trusts.
 * When fetch fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY, we fall back to curl (local only).
 */

"use strict";

const { spawnSync } = require("node:child_process");

const DEFAULT_HOST = "https://aaalife.my.workfront.com";
const DEFAULT_PROJECT_ID = "6abae2b600041e3ecb6a8da4dbe7b4a1";
const DEFAULT_IMS_URL = "https://ims-na1.adobelogin.com/ims/token/v3";
const DEFAULT_SCOPE =
  "openid,session,profile,AdobeID,additional_info.roles,read_organizations,additional_info.projectedProductContext";
const API_VERSION = "v19.0";

/**
 * @param {Record<string, string | undefined>} env
 */
function readConfig(env) {
  return {
    clientId: (env.WORKFRONT_CLIENT_ID || "").trim(),
    clientSecret: (env.WORKFRONT_CLIENT_SECRET || "").trim(),
    /** Local-only fallback when exchanging credentials is not yet configured. Never used in Runtime. */
    accessToken: (env.WORKFRONT_ACCESS_TOKEN || "").trim(),
    host: (env.WORKFRONT_HOST || DEFAULT_HOST).replace(/\/+$/, ""),
    projectId: (env.WORKFRONT_PROJECT_ID || DEFAULT_PROJECT_ID).trim(),
    imsUrl: (env.WORKFRONT_IMS_URL || DEFAULT_IMS_URL).trim(),
    scope: (env.WORKFRONT_IMS_SCOPE || DEFAULT_SCOPE).trim(),
  };
}

/**
 * @param {unknown} error
 */
function isLocalTlsIssuerError(error) {
  const code =
    error && typeof error === "object" && "cause" in error
      ? /** @type {{ cause?: { code?: string } }} */ (error).cause?.code
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
    message.includes("UNABLE_TO_GET_ISSUER_CERT_LOCALLY") ||
    message.includes("unable to get local issuer certificate")
  );
}

/**
 * @param {{ method?: string, url: string, headers?: Record<string, string>, body?: string }} req
 * @returns {{ status: number, text: string }}
 */
function curlRequest(req) {
  const args = ["-sS", "--compressed", "-X", req.method || "GET", "-w", "\n%{http_code}"];
  for (const [key, value] of Object.entries(req.headers || {})) {
    args.push("-H", `${key}: ${value}`);
  }
  if (req.body != null) {
    args.push("--data-binary", req.body);
  }
  args.push(req.url);
  const result = spawnSync("curl", args, {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`curl fallback failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`curl fallback failed: ${(result.stderr || "").trim() || `exit ${result.status}`}`);
  }
  const combined = result.stdout || "";
  const nl = combined.lastIndexOf("\n");
  if (nl < 0) {
    throw new Error("curl fallback returned an empty response.");
  }
  const text = combined.slice(0, nl);
  const status = Number(combined.slice(nl + 1));
  if (!Number.isFinite(status)) {
    throw new Error("curl fallback could not parse HTTP status.");
  }
  return { status, text };
}

/**
 * @param {{ method?: string, url: string, headers?: Record<string, string>, body?: string }} req
 * @returns {Promise<{ status: number, text: string }>}
 */
async function httpRequest(req) {
  try {
    const response = await fetch(req.url, {
      method: req.method || "GET",
      headers: req.headers,
      body: req.body,
    });
    return { status: response.status, text: await response.text() };
  } catch (error) {
    if (!isLocalTlsIssuerError(error)) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    return curlRequest(req);
  }
}

/**
 * @param {ReturnType<typeof readConfig>} config
 * @returns {Promise<{ token: string, source: "ims" | "access_token" }>}
 */
async function resolveAccessToken(config) {
  if (config.clientId && config.clientSecret) {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: config.scope,
    }).toString();
    const response = await httpRequest({
      method: "POST",
      url: config.imsUrl,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    let data;
    try {
      data = JSON.parse(response.text);
    } catch {
      throw new Error(`IMS token exchange returned non-JSON (HTTP ${response.status}).`);
    }
    if (response.status < 200 || response.status >= 300 || !data.access_token) {
      const detail = data.error_description || data.error || `HTTP ${response.status}`;
      throw new Error(`IMS token exchange failed: ${detail}`);
    }
    return { token: String(data.access_token), source: "ims" };
  }

  if (config.accessToken) {
    return { token: config.accessToken, source: "access_token" };
  }

  throw new Error(
    "Missing WORKFRONT_CLIENT_ID/WORKFRONT_CLIENT_SECRET (or local WORKFRONT_ACCESS_TOKEN).",
  );
}

/**
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 */
async function fetchProject(config, token) {
  const url = `${config.host}/attask/api/${API_VERSION}/project/${encodeURIComponent(config.projectId)}?fields=ID,name`;
  const response = await httpRequest({
    method: "GET",
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  let data;
  try {
    data = JSON.parse(response.text);
  } catch {
    throw new Error(`Workfront project GET returned non-JSON (HTTP ${response.status}).`);
  }
  if (response.status < 200 || response.status >= 300) {
    const detail =
      data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(`Workfront project GET failed: ${detail}`);
  }
  const project = data.data || data;
  const id = project.ID || project.id;
  const name = project.name;
  if (!id || !name) {
    throw new Error("Workfront project response was missing ID or name.");
  }
  return { ID: String(id), name: String(name) };
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<{ statusCode: number, headers: Record<string, string>, body: Record<string, unknown> }>}
 */
async function runHealth(env = process.env) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    const config = readConfig(env);
    const { token, source } = await resolveAccessToken(config);
    const project = await fetchProject(config, token);
    return {
      statusCode: 200,
      headers,
      body: {
        connected: true,
        project,
        auth: source === "ims" ? "client_credentials" : "access_token",
        host: config.host,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health check failure.";
    return {
      statusCode: 503,
      headers,
      body: {
        connected: false,
        error: message,
      },
    };
  }
}

module.exports = {
  runHealth,
  readConfig,
  DEFAULT_HOST,
  DEFAULT_PROJECT_ID,
};
