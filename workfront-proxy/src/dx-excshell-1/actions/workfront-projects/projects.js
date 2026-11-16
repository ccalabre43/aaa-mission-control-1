/**
 * Create and list New Projects in TEST PORTFOLIO - CHRIS (WORKFRONT_PORTFOLIO_ID).
 * Create is a bare project (no template, no A3 parameterValues) — name + Overview Description.
 * Status defaults to CUR (Current) so the project appears under the portfolio Projects view.
 * Create requires WORKFRONT_LIVE_SUBMIT=1 and confirmLive: true.
 * List scopes to WORKFRONT_PORTFOLIO_ID (never organization-wide).
 */

/** Workfront project status: Current — required for the portfolio Projects folder listing. */
const PROJECT_STATUS_CURRENT = "CUR";

/** Default Workstart Task name (Assignments default to Pat Gaskin via config). */
const WORKSTART_TASK_NAME = "Workstart";

"use strict";

const {
  readConfig,
  resolveAccessToken,
  authLabel,
  workfrontApi,
} = require("../workfront-shared/client");

/**
 * @param {unknown} value
 */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {Record<string, unknown>} payload
 * @param {{ portfolioId: string }} ids
 */
function validateCreatePayload(payload, ids) {
  const name = text(payload.name);
  if (!name) throw new Error("Project name is required.");
  if (!ids.portfolioId) {
    throw new Error(
      "WORKFRONT_PORTFOLIO_ID is not set. Add the TEST PORTFOLIO - CHRIS id to .env.workfront.local (never VITE_*).",
    );
  }
  return {
    name,
    description: text(payload.description),
    plannedCompletionDate: text(payload.plannedCompletionDate) || null,
    portfolioID: ids.portfolioId,
  };
}

/**
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 * @param {ReturnType<typeof validateCreatePayload>} validated
 */
async function postProject(config, token, validated) {
  /** @type {Record<string, unknown>} */
  const body = {
    name: validated.name,
    description: validated.description,
    portfolioID: validated.portfolioID,
    status: PROJECT_STATUS_CURRENT,
  };
  if (validated.plannedCompletionDate) {
    body.plannedCompletionDate = validated.plannedCompletionDate;
  }
  return workfrontApi(config, token, "project", {
    method: "POST",
    body,
  });
}

/**
 * Create the default Workstart Task on the configured parent project, assigned to Pat Gaskin.
 *
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 * @param {{ projectName: string, projectId: string, projectUrl: string, description: string }} created
 */
async function postWorkstartTask(config, token, created) {
  if (!config.workstartProjectId) {
    throw new Error("WORKFRONT_WORKSTART_PROJECT_ID is not set.");
  }
  if (!config.workstartAssigneeId) {
    throw new Error("WORKFRONT_WORKSTART_ASSIGNEE_ID is not set.");
  }
  const descriptionLines = [
    `Workstart for New Project: ${created.projectName}`,
    `Project ID: ${created.projectId}`,
    `Project URL: ${created.projectUrl}`,
  ];
  if (created.description) {
    descriptionLines.push("", "---", "", created.description);
  }
  /** @type {Record<string, unknown>} */
  const taskBody = {
    name: WORKSTART_TASK_NAME,
    projectID: config.workstartProjectId,
    assignedToID: config.workstartAssigneeId,
    description: descriptionLines.join("\n"),
  };
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
async function runCreateProject(env, body, options = {}) {
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
        error:
          "confirmLive must be true. The UI must show the New Project + Entered By disclosure first.",
      },
    };
  }

  try {
    const validated = validateCreatePayload(body, {
      portfolioId: config.portfolioId,
    });
    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });

    const data = await postProject(config, token, validated);

    const project = data.data || data;
    const id = String(project.ID || project.id || "");
    const name = String(project.name || validated.name);
    if (!id) {
      throw new Error("Workfront create returned no Project ID.");
    }
    const url = `${config.host}/project/view?ID=${encodeURIComponent(id)}`;

    /** @type {{ taskId?: string, taskUrl?: string, taskName?: string, assignedToID?: string, projectID?: string, error?: string }} */
    let workstart = {};
    try {
      const taskData = await postWorkstartTask(config, token, {
        projectName: name,
        projectId: id,
        projectUrl: url,
        description: validated.description,
      });
      const task = taskData.data || taskData;
      const taskId = String(task.ID || task.id || "");
      if (!taskId) {
        throw new Error("Workfront Workstart Task create returned no Task ID.");
      }
      workstart = {
        taskId,
        taskName: String(task.name || WORKSTART_TASK_NAME),
        taskUrl: `${config.host}/task/view?ID=${encodeURIComponent(taskId)}`,
        assignedToID: config.workstartAssigneeId,
        projectID: config.workstartProjectId,
      };
    } catch (taskError) {
      const taskMessage =
        taskError instanceof Error ? taskError.message : "Workstart Task create failed.";
      workstart = {
        error:
          /sufficient access/i.test(taskMessage)
            ? `${taskMessage} The S2S tech account needs Add Tasks on project ${config.workstartProjectId}.`
            : taskMessage,
        projectID: config.workstartProjectId,
        assignedToID: config.workstartAssigneeId,
      };
    }

    return {
      statusCode: 201,
      headers,
      body: {
        ok: true,
        projectId: id,
        ID: id,
        name,
        projectUrl: url,
        url,
        portfolioID: validated.portfolioID,
        objectType: "PROJ",
        customFormApplied: false,
        workstart,
        auth: authLabel(source),
      },
    };
  } catch (error) {
    let message = error instanceof Error ? error.message : "Project create failed.";
    if (/sufficient access/i.test(message)) {
      message =
        `${message} The S2S tech account needs Manage on TEST PORTFOLIO - CHRIS ` +
        `(WORKFRONT_PORTFOLIO_ID) so a New Project can land there. ` +
        `See docs/knowledge/workfront-test-portfolio-acl.md.`;
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
 * List TEST PORTFOLIO - CHRIS projects (summary fields only).
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ bearerToken?: string }} [options]
 */
async function runListProjects(env, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    const config = readConfig(env);
    if (!config.portfolioId) {
      return {
        statusCode: 400,
        headers,
        body: {
          ok: false,
          error:
            "WORKFRONT_PORTFOLIO_ID is not set. Add the TEST PORTFOLIO - CHRIS id to .env.workfront.local (never VITE_*).",
          projects: [],
          coverage:
            "TEST PORTFOLIO project list skipped — WORKFRONT_PORTFOLIO_ID not configured on the proxy.",
        },
      };
    }

    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });
    const fields = [
      "ID",
      "name",
      "status",
      "entryDate",
      "plannedCompletionDate",
      "percentComplete",
      "owner:name",
    ].join(",");
    const query = [
      `portfolioID=${encodeURIComponent(config.portfolioId)}`,
      `fields=${encodeURIComponent(fields)}`,
      "$$LIMIT=100",
    ].join("&");
    const data = await workfrontApi(config, token, `project/search?${query}`);
    const rows = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    const projects = rows.map((row) => {
      const owner = row.owner;
      const ownerName =
        owner && typeof owner === "object" && typeof owner.name === "string"
          ? owner.name
          : null;
      return {
        ID: String(row.ID || row.id || ""),
        name: String(row.name || ""),
        status: row.status != null ? String(row.status) : null,
        priority: null,
        entryDate: row.entryDate != null ? String(row.entryDate) : null,
        queueTopicID: null,
        assignedToName: ownerName,
        percentComplete:
          row.percentComplete != null && Number.isFinite(Number(row.percentComplete))
            ? Number(row.percentComplete)
            : null,
      };
    }).filter((row) => row.ID);

    return {
      statusCode: 200,
      headers,
      body: {
        ok: true,
        portfolioId: config.portfolioId,
        count: projects.length,
        projects,
        auth: authLabel(source),
        coverage:
          `Workfront TEST PORTFOLIO - CHRIS ${config.portfolioId}: ${projects.length} project` +
          `${projects.length === 1 ? "" : "s"} (summary fields). Not organization-wide; local briefs are a separate corpus.`,
      },
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: {
        ok: false,
        projects: [],
        coverage:
          "TEST PORTFOLIO project search failed. Showing local Request Queue rows only.",
        error: error instanceof Error ? error.message : "Project list failed.",
      },
    };
  }
}

module.exports = {
  runCreateProject,
  runListProjects,
};
