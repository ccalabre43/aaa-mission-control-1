/**
 * Shared helpers for Vercel serverless Workfront routes.
 * Reuses workfront-proxy action modules; secrets come from process.env only.
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const actionsRoot = join(__dirname, "..", "workfront-proxy", "src", "dx-excshell-1", "actions");

export const { extractBearerToken } = require(join(actionsRoot, "workfront-shared", "client.js"));
export const { runHealth } = require(join(actionsRoot, "workfront-health", "health.js"));
export const { runCreateIssue, runListIssues } = require(
  join(actionsRoot, "workfront-issues", "issues.js"),
);
export const { runUploadDocument } = require(
  join(actionsRoot, "workfront-documents", "documents.js"),
);
export const { runUpdateTaskPriority } = require(
  join(actionsRoot, "workfront-issues", "updatePriority.js"),
);
export const { runListPortfolioProjects, runApplyPortfolioOrder } = require(
  join(actionsRoot, "workfront-portfolio", "portfolio.js"),
);

/**
 * @param {import('http').IncomingMessage} req
 * @returns {string | undefined}
 */
export function bearerFromReq(req) {
  return extractBearerToken(req.headers);
}

/**
 * @param {import('http').ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} body
 */
export function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
