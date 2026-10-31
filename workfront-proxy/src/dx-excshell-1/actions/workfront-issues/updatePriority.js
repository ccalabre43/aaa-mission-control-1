/**
 * Update Workfront Task priority (urgency). Requires WORKFRONT_LIVE_SUBMIT + confirmLive.
 */

"use strict";

const {
  readConfig,
  resolveAccessToken,
  authLabel,
  workfrontApi,
} = require("../workfront-shared/client");

/** Provisional map: P1→1, P2→2, P3→4 */
const ALLOWED = new Set([1, 2, 4]);

/**
 * @param {unknown} value
 */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parsePriority(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, unknown>} body
 * @param {{ bearerToken?: string }} [options]
 */
async function runUpdateTaskPriority(env, body, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const config = readConfig(env);

  if (!config.liveSubmit) {
    return {
      statusCode: 403,
      headers,
      body: {
        ok: false,
        error:
          "Live submit is off. Set WORKFRONT_LIVE_SUBMIT=1 in .env.workfront.local and restart the proxy.",
      },
    };
  }
  if (body.confirmLive !== true) {
    return {
      statusCode: 400,
      headers,
      body: {
        ok: false,
        error: "confirmLive must be true before updating Task priority.",
      },
    };
  }

  const taskId = text(body.taskId);
  const priority = parsePriority(body.priority);
  if (!taskId) {
    return {
      statusCode: 400,
      headers,
      body: { ok: false, error: "taskId is required." },
    };
  }
  if (priority == null || !ALLOWED.has(priority)) {
    return {
      statusCode: 400,
      headers,
      body: {
        ok: false,
        error: "priority must be 1 (P1), 2 (P2), or 4 (P3).",
      },
    };
  }

  try {
    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });
    const data = await workfrontApi(config, token, "TASK", {
      method: "PUT",
      body: { ID: taskId, priority },
    });
    const task = data.data || data;
    return {
      statusCode: 200,
      headers,
      body: {
        ok: true,
        taskId: String(task.ID || task.id || taskId),
        priority,
        auth: authLabel(source),
        coverage: `Task ${taskId} priority set to ${priority} on mission-control-v1.`,
      },
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: {
        ok: false,
        error: error instanceof Error ? error.message : "Task priority update failed.",
      },
    };
  }
}

module.exports = {
  runUpdateTaskPriority,
  ALLOWED_PRIORITIES: ALLOWED,
};
