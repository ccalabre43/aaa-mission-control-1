/**
 * Vercel serverless: GET/POST /api/workfront/issues
 * Same contract as workfront-proxy local stand-in and Runtime workfront-issues action.
 */

import {
  bearerFromReq,
  runCreateIssue,
  runListIssues,
  sendJson,
} from "../../lib/workfront-vercel.mjs";

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
      } catch {
        reject(new Error("Request body must be JSON."));
      }
    });
    req.on("error", reject);
  });
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === "GET") {
      const result = await runListIssues(process.env, { bearerToken: bearerFromReq(req) });
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const result = await runCreateIssue(process.env, body, {
        bearerToken: bearerFromReq(req),
      });
      sendJson(res, result.statusCode, result.body);
      return;
    }

    sendJson(res, 405, {
      ok: false,
      error: "Method not allowed. Use GET or POST.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workfront issues failure.";
    const status = message.includes("must be JSON") ? 400 : 500;
    sendJson(res, status, { ok: false, error: message });
  }
}
