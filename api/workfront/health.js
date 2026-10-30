/**
 * Vercel serverless: GET /api/workfront/health
 * Same contract as workfront-proxy local stand-in and Runtime workfront-health action.
 */

import { bearerFromReq, runHealth, sendJson } from "../../lib/workfront-vercel.mjs";

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
  if (req.method !== "GET") {
    sendJson(res, 405, {
      connected: false,
      liveSubmit: false,
      error: "Method not allowed. Use GET.",
    });
    return;
  }

  try {
    const result = await runHealth(process.env, { bearerToken: bearerFromReq(req) });
    sendJson(res, result.statusCode, result.body);
  } catch (error) {
    sendJson(res, 500, {
      connected: false,
      liveSubmit: false,
      error: error instanceof Error ? error.message : "Workfront health failure.",
    });
  }
}
