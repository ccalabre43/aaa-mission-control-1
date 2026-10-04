/**
 * Adobe App Builder Runtime web action: Workfront health.
 *
 * Secrets arrive as action inputs / Runtime parameters (never in the Vite bundle):
 * WORKFRONT_CLIENT_ID, WORKFRONT_CLIENT_SECRET, WORKFRONT_HOST, WORKFRONT_PROJECT_ID.
 */

"use strict";

const { runHealth } = require("./health");

/**
 * Runtime packs action inputs onto `params`. Prefer those over process.env so deployed
 * secrets win over whatever the container inherited.
 *
 * @param {Record<string, unknown>} params
 */
function envFromParams(params) {
  const keys = [
    "WORKFRONT_CLIENT_ID",
    "WORKFRONT_CLIENT_SECRET",
    "WORKFRONT_HOST",
    "WORKFRONT_PROJECT_ID",
    "WORKFRONT_IMS_URL",
    "WORKFRONT_IMS_SCOPE",
  ];
  /** @type {Record<string, string | undefined>} */
  const env = { ...process.env };
  for (const key of keys) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      env[key] = value.trim();
    }
  }
  return env;
}

/**
 * @param {Record<string, unknown>} params
 */
async function main(params = {}) {
  // CORS preflight for browser callers that hit the Runtime URL directly.
  if (params.__ow_method === "options" || params.__ow_method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Max-Age": "86400",
      },
      body: {},
    };
  }

  const result = await runHealth(envFromParams(params));
  return {
    statusCode: result.statusCode,
    headers: {
      ...result.headers,
      "Access-Control-Allow-Origin": "*",
    },
    body: result.body,
  };
}

exports.main = main;
