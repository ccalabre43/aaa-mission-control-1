/**
 * Adobe App Builder Runtime web action: create / list New Projects in TEST PORTFOLIO - CHRIS.
 *
 * GET → list projects in WORKFRONT_PORTFOLIO_ID (summary fields).
 * POST → create project from WORKFRONT_TEMPLATE_ID when kill switch + confirmLive.
 */

"use strict";

const { extractBearerToken } = require("../workfront-shared/client");
const { runCreateProject, runListProjects } = require("./projects");

/**
 * @param {Record<string, unknown>} params
 */
function envFromParams(params) {
  const keys = [
    "WORKFRONT_CLIENT_ID",
    "WORKFRONT_CLIENT_SECRET",
    "WORKFRONT_HOST",
    "WORKFRONT_PROJECT_ID",
    "WORKFRONT_PORTFOLIO_ID",
    "WORKFRONT_BRAND_PORTFOLIO_ID",
    "WORKFRONT_TEMPLATE_ID",
    "WORKFRONT_IMS_URL",
    "WORKFRONT_IMS_SCOPE",
    "WORKFRONT_LIVE_SUBMIT",
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
function parseBody(params) {
  const raw = params.__ow_body;
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return /** @type {Record<string, unknown>} */ (raw);
  }
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? /** @type {Record<string, unknown>} */ (parsed)
      : {};
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, unknown>} params
 */
async function main(params = {}) {
  const method = String(params.__ow_method || "get").toLowerCase();

  if (method === "options") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Max-Age": "86400",
      },
      body: {},
    };
  }

  const env = envFromParams(params);
  const bearerToken = extractBearerToken(params.__ow_headers);
  const result =
    method === "post"
      ? await runCreateProject(env, parseBody(params), { bearerToken })
      : await runListProjects(env, { bearerToken });

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
