/**
 * Minimal Microsoft Graph Excel helpers for the Deep Dive SharePoint workbook.
 * Credentials stay on the server (env). Never expose tokens to the Vite client.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

/**
 * @param {Record<string, string>} env
 * @returns {Promise<{ token: string | null; mode: string; error?: string }>}
 */
export async function resolveAccessToken(env) {
  const bearer = (env.GRAPH_ACCESS_TOKEN || "").trim();
  if (bearer) {
    return { token: bearer, mode: "access_token" };
  }

  const tenant = (env.GRAPH_TENANT_ID || "").trim();
  const clientId = (env.GRAPH_CLIENT_ID || "").trim();
  const clientSecret = (env.GRAPH_CLIENT_SECRET || "").trim();
  if (!tenant || !clientId || !clientSecret) {
    return {
      token: null,
      mode: "none",
      error:
        "No GRAPH_ACCESS_TOKEN or GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET in .env.deep-dive.local.",
    };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    return {
      token: null,
      mode: "client_credentials",
      error: json.error_description || json.error || `Token HTTP ${res.status}`,
    };
  }
  return { token: json.access_token, mode: "client_credentials" };
}

function workbookPath(env) {
  const siteId = (env.GRAPH_SITE_ID || "").trim();
  const itemId = (env.GRAPH_ITEM_ID || "").trim();
  const driveId = (env.GRAPH_DRIVE_ID || "").trim();
  if (!siteId || !itemId) {
    return { error: "GRAPH_SITE_ID and GRAPH_ITEM_ID are required." };
  }
  if (driveId) {
    return {
      base: `${GRAPH}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/workbook`,
    };
  }
  return {
    base: `${GRAPH}/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(itemId)}/workbook`,
  };
}

/**
 * @param {Record<string, string>} env
 * @param {string} token
 * @param {string} pathSuffix
 * @param {RequestInit} [init]
 */
export async function graphWorkbook(env, token, pathSuffix, init = {}) {
  const wb = workbookPath(env);
  if (wb.error) {
    return { ok: false, status: 400, body: { error: wb.error } };
  }
  const url = `${wb.base}${pathSuffix}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

export function worksheetId(env) {
  return (env.GRAPH_WORKSHEET_ID || "Sheet1").trim() || "Sheet1";
}

/**
 * Create a persistent workbook session (required for reliable writes).
 * @param {Record<string, string>} env
 * @param {string} token
 */
export async function createSession(env, token) {
  return graphWorkbook(env, token, "/createSession", {
    method: "POST",
    body: JSON.stringify({ persistChanges: true }),
  });
}

/**
 * @param {Record<string, string>} env
 * @param {string} token
 * @param {string} sessionId
 */
export async function closeSession(env, token, sessionId) {
  return graphWorkbook(env, token, "/closeSession", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "workbook-session-id": sessionId },
  });
}

/**
 * @param {Record<string, string>} env
 * @param {string} token
 * @param {string} [sessionId]
 */
export async function getUsedRange(env, token, sessionId) {
  const sheet = encodeURIComponent(worksheetId(env));
  return graphWorkbook(
    env,
    token,
    `/worksheets/${sheet}/usedRange(valuesOnly=true)`,
    sessionId ? { headers: { "workbook-session-id": sessionId } } : {},
  );
}

/**
 * @param {Record<string, string>} env
 * @param {string} token
 * @param {string} address
 * @param {unknown[][]} values
 * @param {string} sessionId
 */
export async function updateRange(env, token, address, values, sessionId) {
  const sheet = encodeURIComponent(worksheetId(env));
  const addr = encodeURIComponent(address);
  return graphWorkbook(env, token, `/worksheets/${sheet}/range(address='${addr}')`, {
    method: "PATCH",
    headers: { "workbook-session-id": sessionId },
    body: JSON.stringify({ values }),
  });
}
