/**
 * Create and list Brand Team Projects from the Email Creative Development template.
 * Create requires WORKFRONT_LIVE_SUBMIT=1 and confirmLive: true.
 * List scopes to WORKFRONT_BRAND_PORTFOLIO_ID (never organization-wide).
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
 * @param {{ templateId: string, brandPortfolioId: string }} ids
 */
function validateCreatePayload(payload, ids) {
  const name = text(payload.name);
  if (!name) throw new Error("Project name is required.");
  if (!ids.templateId) {
    throw new Error(
      "WORKFRONT_TEMPLATE_ID is not set. Use the TMPL id behind the Email Creative Development pattern (not the Project URL id).",
    );
  }
  if (!ids.brandPortfolioId) {
    throw new Error(
      "WORKFRONT_BRAND_PORTFOLIO_ID is not set. Add the Brand Team portfolio id to .env.workfront.local (never VITE_*).",
    );
  }
  return {
    name,
    description: text(payload.description),
    plannedCompletionDate: text(payload.plannedCompletionDate) || null,
    templateID: ids.templateId,
    portfolioID: ids.brandPortfolioId,
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
async function postProject(config, token, validated, withCustomForm) {
  /** @type {Record<string, unknown>} */
  const body = {
    name: validated.name,
    description: validated.description,
    templateID: validated.templateID,
    portfolioID: validated.portfolioID,
  };
  if (validated.plannedCompletionDate) {
    body.plannedCompletionDate = validated.plannedCompletionDate;
  }
  if (withCustomForm && Object.keys(validated.customForm).length > 0) {
    body.parameterValues = toParameterValues(validated.customForm);
  }
  return workfrontApi(config, token, "project", {
    method: "POST",
    body,
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
          "confirmLive must be true. The UI must show the Brand project + Entered By disclosure first.",
      },
    };
  }

  try {
    const validated = validateCreatePayload(body, {
      templateId: config.templateId,
      brandPortfolioId: config.brandPortfolioId,
    });
    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });

    let data;
    let usedCustomForm = Object.keys(validated.customForm).length > 0;
    try {
      data = await postProject(config, token, validated, usedCustomForm);
    } catch (firstError) {
      if (!usedCustomForm) throw firstError;
      data = await postProject(config, token, validated, false);
      usedCustomForm = false;
    }

    const project = data.data || data;
    const id = String(project.ID || project.id || "");
    const name = String(project.name || validated.name);
    if (!id) {
      throw new Error("Workfront create returned no Project ID.");
    }
    const url = `${config.host}/project/view?ID=${encodeURIComponent(id)}`;
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
        templateID: validated.templateID,
        objectType: "PROJ",
        customFormApplied: usedCustomForm,
        auth: authLabel(source),
      },
    };
  } catch (error) {
    let message = error instanceof Error ? error.message : "Project create failed.";
    if (/sufficient access/i.test(message)) {
      message =
        `${message} The S2S tech account needs View/Use on the Email Creative Development ` +
        `Template (TMPL) and Manage on the Brand Team portfolio so projects can land there. ` +
        `See docs/knowledge/workfront-brand-project-acl.md.`;
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
 * List Brand Team portfolio projects (summary fields only).
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
    if (!config.brandPortfolioId) {
      return {
        statusCode: 400,
        headers,
        body: {
          ok: false,
          error:
            "WORKFRONT_BRAND_PORTFOLIO_ID is not set. Add the Brand Team portfolio id to .env.workfront.local (never VITE_*).",
          projects: [],
          coverage:
            "Brand Team project list skipped — brand portfolio ID not configured on the proxy.",
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
      `portfolioID=${encodeURIComponent(config.brandPortfolioId)}`,
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
        portfolioId: config.brandPortfolioId,
        count: projects.length,
        projects,
        auth: authLabel(source),
        coverage:
          `Workfront Brand Team portfolio ${config.brandPortfolioId}: ${projects.length} project` +
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
          "Brand Team portfolio project search failed. Showing local Request Queue rows only.",
        error: error instanceof Error ? error.message : "Project list failed.",
      },
    };
  }
}

module.exports = {
  runCreateProject,
  runListProjects,
};
