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
    return {
      statusCode: 200,
      headers,
      body: {
        connected: true,
        project,
        auth: authLabel(source),
        host: config.host,
        liveSubmit: config.liveSubmit,
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
        error: message,
      },
    };
  }
}

module.exports = {
  runHealth,
  readConfig,
  DEFAULT_HOST,
  DEFAULT_PROJECT_ID,
};
