/**
 * Shared IMS + Workfront HTTP helpers for health, create, and list actions.
 * Never logs tokens or secrets. Curl fallback for corp TLS intercept (local only).
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
    accessToken: (env.WORKFRONT_ACCESS_TOKEN || "").trim(),
    host: (env.WORKFRONT_HOST || DEFAULT_HOST).replace(/\/+$/, ""),
    projectId: (env.WORKFRONT_PROJECT_ID || DEFAULT_PROJECT_ID).trim(),
    /** Portfolio ID for TEST PORTFOLIO - CHRIS (Portfolio Optimization ranks). Never VITE_*. */
    portfolioId: (env.WORKFRONT_PORTFOLIO_ID || "").trim(),
    imsUrl: (env.WORKFRONT_IMS_URL || DEFAULT_IMS_URL).trim(),
    scope: (env.WORKFRONT_IMS_SCOPE || DEFAULT_SCOPE).trim(),
    liveSubmit: /^(1|true|yes)$/i.test((env.WORKFRONT_LIVE_SUBMIT || "").trim()),
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
 * @param {{ method?: string, url: string, headers?: Record<string, string>, body?: string | Buffer }} req
 */
function curlRequest(req) {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const args = ["-sS", "--compressed", "-X", req.method || "GET", "-w", "\n%{http_code}"];
  for (const [key, value] of Object.entries(req.headers || {})) {
    args.push("-H", `${key}: ${value}`);
  }
  /** @type {string | null} */
  let tempPath = null;
  try {
    if (req.body != null) {
      if (Buffer.isBuffer(req.body)) {
        tempPath = path.join(
          os.tmpdir(),
          `wf-upload-${process.pid}-${Date.now()}.bin`,
        );
        fs.writeFileSync(tempPath, req.body);
        args.push("--data-binary", `@${tempPath}`);
      } else {
        args.push("--data-binary", req.body);
      }
    }
    args.push(req.url);
    const result = spawnSync("curl", args, {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error) {
      throw new Error(`curl fallback failed to start: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(
        `curl fallback failed: ${(result.stderr || "").trim() || `exit ${result.status}`}`,
      );
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
  } finally {
    if (tempPath) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore temp cleanup failures
      }
    }
  }
}

/**
 * @param {{ method?: string, url: string, headers?: Record<string, string>, body?: string | Buffer }} req
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
 * Read Authorization: Bearer from request headers (case-insensitive). Never log the value.
 *
 * @param {unknown} headers
 * @returns {string} token or empty string
 */
function extractBearerToken(headers) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return "";
  }
  /** @type {Record<string, unknown>} */
  const map = /** @type {Record<string, unknown>} */ (headers);
  let raw = "";
  for (const [key, value] of Object.entries(map)) {
    if (key.toLowerCase() === "authorization" && typeof value === "string") {
      raw = value;
      break;
    }
  }
  const match = /^Bearer\s+(\S+)/i.exec(raw.trim());
  return match ? match[1].trim() : "";
}

/**
 * Prefer an incoming user Bearer (ExC Shell IMS). Fall back to S2S client_credentials
 * or local WORKFRONT_ACCESS_TOKEN. Never logs tokens.
 *
 * @param {ReturnType<typeof readConfig>} config
 * @param {{ bearerToken?: string }} [options]
 */
async function resolveAccessToken(config, options = {}) {
  const bearer =
    typeof options.bearerToken === "string" ? options.bearerToken.trim() : "";
  if (bearer) {
    return { token: bearer, source: /** @type {const} */ ("bearer") };
  }

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
    return { token: String(data.access_token), source: /** @type {const} */ ("ims") };
  }

  if (config.accessToken) {
    return { token: config.accessToken, source: /** @type {const} */ ("access_token") };
  }

  throw new Error(
    "Missing Authorization Bearer, or WORKFRONT_CLIENT_ID/WORKFRONT_CLIENT_SECRET (or local WORKFRONT_ACCESS_TOKEN).",
  );
}

/**
 * @param {"bearer" | "ims" | "access_token"} source
 */
function authLabel(source) {
  if (source === "bearer") return "bearer";
  if (source === "ims") return "client_credentials";
  return "access_token";
}

/**
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 * @param {string} pathAndQuery path after /attask/api/vX/
 * @param {{ method?: string, body?: unknown }} [opts]
 */
async function workfrontApi(config, token, pathAndQuery, opts = {}) {
  const url = `${config.host}/attask/api/${API_VERSION}/${pathAndQuery.replace(/^\//, "")}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  let body;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const response = await httpRequest({
    method: opts.method || "GET",
    url,
    headers,
    body,
  });
  let data;
  try {
    data = response.text ? JSON.parse(response.text) : {};
  } catch {
    throw new Error(`Workfront returned non-JSON (HTTP ${response.status}).`);
  }
  if (response.status < 200 || response.status >= 300) {
    const detail =
      data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(`Workfront API failed: ${detail}`);
  }
  return data;
}

/**
 * @param {Record<string, string>} customForm
 */
function toParameterValues(customForm) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(customForm || {})) {
    if (value == null || String(value).trim() === "") continue;
    const paramKey = key.startsWith("DE:") ? key : `DE:${key}`;
    out[paramKey] = String(value);
  }
  return out;
}

/**
 * Build multipart/form-data body with field name `uploadedFile` for Workfront /upload.
 *
 * @param {string} fileName
 * @param {string} mimeType
 * @param {Buffer} buffer
 */
function buildUploadedFileMultipart(fileName, mimeType, buffer) {
  const boundary = `----MissionControlBoundary${Date.now().toString(16)}`;
  const safeName = String(fileName || "upload.bin").replace(/"/g, "");
  const type = mimeType && String(mimeType).trim() ? String(mimeType) : "application/octet-stream";
  const header =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="uploadedFile"; filename="${safeName}"\r\n` +
    `Content-Type: ${type}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([
    Buffer.from(header, "utf8"),
    buffer,
    Buffer.from(footer, "utf8"),
  ]);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body,
  };
}

/**
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 * @param {string} fileName
 * @param {string} mimeType
 * @param {Buffer} buffer
 */
async function uploadMultipartToWorkfront(config, token, fileName, mimeType, buffer) {
  const multipart = buildUploadedFileMultipart(fileName, mimeType, buffer);
  const url = `${config.host}/attask/api/${API_VERSION}/upload`;
  const response = await httpRequest({
    method: "POST",
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": multipart.contentType,
    },
    body: multipart.body,
  });
  let data;
  try {
    data = response.text ? JSON.parse(response.text) : {};
  } catch {
    throw new Error(`Workfront upload returned non-JSON (HTTP ${response.status}).`);
  }
  if (response.status < 200 || response.status >= 300) {
    const detail =
      data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(`Workfront upload failed: ${detail}`);
  }
  const handle =
    data?.data?.handle ||
    data?.handle ||
    (data?.data && typeof data.data === "object" ? data.data.handle : null);
  if (!handle || typeof handle !== "string") {
    throw new Error("Workfront upload returned no handle.");
  }
  return { handle: String(handle) };
}

/**
 * Find or create the project document folder named `folderName` (default Tasks).
 *
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 * @param {string} projectId
 * @param {string} [folderName]
 */
async function ensureProjectFolder(config, token, projectId, folderName = "Tasks") {
  const query = [
    `projectID=${encodeURIComponent(projectId)}`,
    `name=${encodeURIComponent(folderName)}`,
    "fields=ID,name,projectID",
    "$$LIMIT=20",
  ].join("&");
  const search = await workfrontApi(config, token, `DOCFDR/search?${query}`);
  const rows = Array.isArray(search.data)
    ? search.data
    : Array.isArray(search)
      ? search
      : [];
  const existing = rows.find(
    (row) =>
      row &&
      typeof row === "object" &&
      String(row.name || "").toLowerCase() === folderName.toLowerCase(),
  );
  if (existing && (existing.ID || existing.id)) {
    return String(existing.ID || existing.id);
  }

  const created = await workfrontApi(config, token, "DOCFDR", {
    method: "POST",
    body: {
      name: folderName,
      projectID: projectId,
    },
  });
  const folder = created.data || created;
  const id = String(folder.ID || folder.id || "");
  if (!id) {
    throw new Error(`Could not create Workfront document folder "${folderName}".`);
  }
  return id;
}

/**
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 * @param {{ name: string, handle: string, docObjCode: string, objID: string, folderID?: string }} input
 */
async function attachWorkfrontDocument(config, token, input) {
  /** @type {Record<string, unknown>} */
  const updates = {
    name: input.name,
    handle: input.handle,
    docObjCode: input.docObjCode,
    objID: input.objID,
    currentVersion: {
      version: "1.0",
      fileName: input.name,
    },
  };
  if (input.folderID) {
    updates.folderID = input.folderID;
  }
  const data = await workfrontApi(
    config,
    token,
    `document?updates=${encodeURIComponent(JSON.stringify(updates))}`,
    { method: "POST" },
  );
  const doc = data.data || data;
  const id = String(doc.ID || doc.id || "");
  if (!id) {
    throw new Error(`Workfront document create returned no ID for ${input.name}.`);
  }
  return { ID: id, name: String(doc.name || input.name) };
}

module.exports = {
  API_VERSION,
  DEFAULT_HOST,
  DEFAULT_PROJECT_ID,
  readConfig,
  httpRequest,
  extractBearerToken,
  resolveAccessToken,
  authLabel,
  workfrontApi,
  toParameterValues,
  uploadMultipartToWorkfront,
  ensureProjectFolder,
  attachWorkfrontDocument,
};
