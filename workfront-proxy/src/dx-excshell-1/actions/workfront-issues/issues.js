/**
 * Create and list Tasks on the configured Workfront project (mission-control-v1).
 * HTTP paths remain /issues for client compatibility; the Workfront object is TASK.
 * Create requires WORKFRONT_LIVE_SUBMIT=1 and confirmLive: true in the body.
 */

"use strict";

const {
  readConfig,
  resolveAccessToken,
  authLabel,
  workfrontApi,
  toParameterValues,
} = require("../workfront-shared/client");

/**
 * @param {unknown} value
 */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} configuredProjectId
 */
function validateCreatePayload(payload, configuredProjectId) {
  const name = text(payload.name);
  const projectID = text(payload.projectID);
  if (!name) throw new Error("Task name is required.");
  if (!projectID) throw new Error("projectID is required.");
  if (projectID !== configuredProjectId) {
    throw new Error(
      `projectID must match the configured queue project (${configuredProjectId}).`,
    );
  }
  const priorityRaw = payload.priority;
  let priority = null;
  if (typeof priorityRaw === "number" && Number.isFinite(priorityRaw)) {
    priority = priorityRaw;
  } else if (typeof priorityRaw === "string" && priorityRaw.trim()) {
    const n = Number(priorityRaw.trim());
    if (Number.isFinite(n)) priority = n;
  }
  if (priority != null && ![1, 2, 4].includes(priority)) {
    throw new Error("priority must be 1 (P1), 2 (P2), or 4 (P3) when provided.");
  }

  return {
    name,
    description: text(payload.description),
    plannedCompletionDate: text(payload.plannedCompletionDate) || null,
    projectID,
    priority,
    customForm:
      payload.customForm && typeof payload.customForm === "object"
        ? /** @type {Record<string, string>} */ (payload.customForm)
        : {},
  };
}

/**
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 * @param {ReturnType<typeof validateCreatePayload>} validated
 * @param {boolean} withCustomForm
 */
async function postTask(config, token, validated, withCustomForm) {
  /** @type {Record<string, unknown>} */
  const taskBody = {
    name: validated.name,
    description: validated.description,
    projectID: validated.projectID,
  };
  if (validated.plannedCompletionDate) {
    taskBody.plannedCompletionDate = validated.plannedCompletionDate;
  }
  if (validated.priority != null) {
    taskBody.priority = validated.priority;
  }
  if (withCustomForm && Object.keys(validated.customForm).length > 0) {
    taskBody.parameterValues = toParameterValues(validated.customForm);
  }
  return workfrontApi(config, token, "TASK", {
    method: "POST",
    body: taskBody,
  });
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, unknown>} body
 * @param {{ bearerToken?: string }} [options]
 */
async function runCreateIssue(env, body, options = {}) {
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
        error: "confirmLive must be true. The UI must show the Entered By disclosure first.",
      },
    };
  }

  try {
    const validated = validateCreatePayload(body, config.projectId);
    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });

    let data;
    let usedCustomForm = Object.keys(validated.customForm).length > 0;
    try {
      data = await postTask(config, token, validated, usedCustomForm);
    } catch (firstError) {
      if (!usedCustomForm) throw firstError;
      // A3 custom fields may be Issue-only; retry with description alone (values already in body).
      data = await postTask(config, token, validated, false);
      usedCustomForm = false;
    }

    const task = data.data || data;
    const id = String(task.ID || task.id || "");
    const name = String(task.name || validated.name);
    if (!id) {
      throw new Error("Workfront create returned no Task ID.");
    }
    const url = `${config.host}/task/view?ID=${encodeURIComponent(id)}`;
    return {
      statusCode: 201,
      headers,
      body: {
        ok: true,
        ID: id,
        name,
        url,
        projectID: validated.projectID,
        objectType: "TASK",
        customFormApplied: usedCustomForm,
        auth: authLabel(source),
      },
    };
  } catch (error) {
    let message = error instanceof Error ? error.message : "Task create failed.";
    if (/sufficient access/i.test(message) && /add this Task/i.test(message)) {
      message =
        `${message} The S2S tech account Access Level must allow Task create ` +
        `(see docs/knowledge/workfront-add-tasks-acl.md). List can work while create is blocked.`;
    }
    return {
      statusCode: 502,
      headers,
      body: {
        ok: false,
        error: message,
      },
    };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ bearerToken?: string }} [options]
 */
async function runListIssues(env, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    const config = readConfig(env);
    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });
    const fields = [
      "ID",
      "name",
      "status",
      "priority",
      "entryDate",
      "plannedCompletionDate",
      "assignedTo:name",
      "percentComplete",
    ].join(",");
    const query = [
      `projectID=${encodeURIComponent(config.projectId)}`,
      `fields=${encodeURIComponent(fields)}`,
      "$$LIMIT=100",
    ].join("&");
    const data = await workfrontApi(config, token, `TASK/search?${query}`);
    const rows = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    const issues = rows.map((row) => {
      const assigned = row.assignedTo;
      const assignedName =
        assigned && typeof assigned === "object" && typeof assigned.name === "string"
          ? assigned.name
          : null;
      return {
        ID: String(row.ID || row.id || ""),
        name: String(row.name || ""),
        status: row.status != null ? String(row.status) : null,
        priority: row.priority != null ? String(row.priority) : null,
        entryDate: row.entryDate != null ? String(row.entryDate) : null,
        plannedCompletionDate:
          row.plannedCompletionDate != null ? String(row.plannedCompletionDate) : null,
        queueTopicID: null,
        assignedToName: assignedName,
        percentComplete:
          typeof row.percentComplete === "number" ? row.percentComplete : null,
        objectType: "TASK",
      };
    });
    return {
      statusCode: 200,
      headers,
      body: {
        ok: true,
        projectID: config.projectId,
        count: issues.length,
        issues,
        objectType: "TASK",
        auth: authLabel(source),
        coverage:
          `Tasks on Workfront project ${config.projectId} (mission-control-v1) via proxy — not organization-wide.`,
      },
    };
  } catch (error) {
    return {
      statusCode: 503,
      headers,
      body: {
        ok: false,
        error: error instanceof Error ? error.message : "Task list failed.",
        coverage:
          "Workfront Task search failed. Local Request Queue data was not replaced.",
      },
    };
  }
}

module.exports = {
  runCreateIssue,
  runListIssues,
};
