/**
 * Shared Workfront health check for the App Builder Runtime action and the local proxy.
 */

"use strict";

const {
  readConfig,
  resolveAccessToken,
  authLabel,
  workfrontApi,
  DEFAULT_HOST,
  DEFAULT_PROJECT_ID,
} = require("../workfront-shared/client");

/**
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 */
async function fetchProject(config, token) {
  const data = await workfrontApi(
    config,
    token,
    `project/${encodeURIComponent(config.projectId)}?fields=ID,name`,
  );
  const project = data.data || data;
  const id = project.ID || project.id;
  const name = project.name;
  if (!id || !name) {
    throw new Error("Workfront project response was missing ID or name.");
  }
  return { ID: String(id), name: String(name) };
}

/**
 * Probes the create/list portfolio (TEST PORTFOLIO - CHRIS) via project search.
 * S2S often cannot GET portfolio/<id> directly. Does not prove portfolio Manage.
 *
 * @param {ReturnType<typeof readConfig>} config
 * @param {string} token
 * @returns {Promise<{
 *   id: string,
 *   reachable: boolean,
 *   projectCount: number,
 *   sample: Array<{ ID: string, name: string }>,
 *   probed: string,
 *   reason?: string,
 * }>}
 */
async function probeCreatePortfolio(config, token) {
  const id = config.portfolioId;
  if (!id) {
    return {
      id: "",
      reachable: false,
      projectCount: 0,
      sample: [],
      probed: "none",
      reason: "WORKFRONT_PORTFOLIO_ID is not set on the proxy.",
    };
  }

  const probed = `project/search?portfolioID=${id}&fields=ID,name&$$LIMIT=5`;
  try {
    const data = await workfrontApi(config, token, probed);
    const rows = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    const sample = rows.slice(0, 5).map((row) => ({
      ID: String(row.ID || row.id || ""),
      name: String(row.name || ""),
    })).filter((row) => row.ID);

    return {
      id,
      reachable: true,
      projectCount: sample.length,
      sample,
      probed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create portfolio probe failed.";
    return {
      id,
      reachable: false,
      projectCount: 0,
      sample: [],
      probed,
      reason: message,
    };
  }
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {{ bearerToken?: string }} [options]
 */
async function runHealth(env = process.env, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    const config = readConfig(env);
    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });

    /**
     * Legacy queue project (WORKFRONT_PROJECT_ID, mission-control-v1) is optional — decision 061.
     * A deleted queue project must not mark Workfront disconnected when auth + portfolio work.
     * @type {{ ID: string, name: string } | undefined}
     */
    let project;
    /** @type {string | undefined} */
    let queueProjectError;
    try {
      project = await fetchProject(config, token);
    } catch (projectError) {
      queueProjectError =
        projectError instanceof Error ? projectError.message : "Queue project check failed.";
    }

    const createPortfolio = await probeCreatePortfolio(config, token);
    if (!project && !createPortfolio.reachable) {
      // Neither probe succeeded: surface the legacy project error (original behavior).
      throw new Error(queueProjectError || createPortfolio.reason || "Workfront health failed.");
    }

    const projectCreateConfigured = Boolean(config.portfolioId);
    return {
      statusCode: 200,
      headers,
      body: {
        connected: true,
        ...(project ? { project } : {}),
        ...(queueProjectError
          ? {
              queueProject: {
                id: config.projectId,
                reachable: false,
                reason: queueProjectError,
              },
            }
          : {}),
        createPortfolio,
        /** @deprecated decision 057 — same as createPortfolio; kept for transitional clients */
        brandPortfolio: createPortfolio,
        auth: authLabel(source),
        host: config.host,
        liveSubmit: config.liveSubmit,
        projectCreateConfigured,
        /** @deprecated decision 057 — alias of projectCreateConfigured */
        brandCreateConfigured: projectCreateConfigured,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health check failure.";
    const emptyPortfolio = {
      id: "",
      reachable: false,
      projectCount: 0,
      sample: [],
      probed: "none",
      reason: "Health failed before the create portfolio probe ran.",
    };
    return {
      statusCode: 503,
      headers,
      body: {
        connected: false,
        liveSubmit: false,
        projectCreateConfigured: false,
        brandCreateConfigured: false,
        createPortfolio: emptyPortfolio,
        brandPortfolio: emptyPortfolio,
        error: message,
      },
    };
  }
}

module.exports = {
  runHealth,
  probeCreatePortfolio,
  readConfig,
  DEFAULT_HOST,
  DEFAULT_PROJECT_ID,
};
