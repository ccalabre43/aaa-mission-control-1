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
 * Probes Brand Team portfolio reachability via project search (S2S often cannot
 * GET portfolio/<id> directly). Does not prove Template Use or portfolio Manage.
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
async function probeBrandPortfolio(config, token) {
  const id = config.brandPortfolioId;
  if (!id) {
    return {
      id: "",
      reachable: false,
      projectCount: 0,
      sample: [],
      probed: "none",
      reason: "WORKFRONT_BRAND_PORTFOLIO_ID is not set on the proxy.",
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
    const message = error instanceof Error ? error.message : "Brand portfolio probe failed.";
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
    const project = await fetchProject(config, token);
    const brandPortfolio = await probeBrandPortfolio(config, token);
    return {
      statusCode: 200,
      headers,
      body: {
        connected: true,
        project,
        brandPortfolio,
        auth: authLabel(source),
        host: config.host,
        liveSubmit: config.liveSubmit,
        brandCreateConfigured: Boolean(config.templateId && config.brandPortfolioId),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health check failure.";
    return {
      statusCode: 503,
      headers,
      body: {
        connected: false,
        liveSubmit: false,
        brandCreateConfigured: false,
        brandPortfolio: {
          id: "",
          reachable: false,
          projectCount: 0,
          sample: [],
          probed: "none",
          reason: "Health failed before the Brand portfolio probe ran.",
        },
        error: message,
      },
    };
  }
}

module.exports = {
  runHealth,
  probeBrandPortfolio,
  readConfig,
  DEFAULT_HOST,
  DEFAULT_PROJECT_ID,
};
