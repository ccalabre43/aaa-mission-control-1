/**
 * List and apply Portfolio Optimization ranks (project portfolioPriority).
 * Apply requires WORKFRONT_LIVE_SUBMIT + confirmLive.
 */

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
 * @param {unknown[]} ordered
 * @returns {Array<{ projectId: string, portfolioPriority: number }>}
 */
function buildRanks(ordered) {
  const ids = [];
  for (const item of ordered) {
    if (typeof item === "string" && item.trim()) {
      ids.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const id = text(/** @type {Record<string, unknown>} */ (item).projectId);
      if (id) ids.push(id);
    }
  }
  return ids.map((projectId, index) => ({
    projectId,
    portfolioPriority: index + 1,
  }));
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ bearerToken?: string }} [options]
 */
async function runListPortfolioProjects(env, options = {}) {
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
            "WORKFRONT_PORTFOLIO_ID is not set. Add the Portfolio ID for TEST PORTFOLIO - CHRIS to .env.workfront.local (never VITE_*).",
          projects: [],
          coverage:
            "Portfolio Optimization list skipped — portfolio ID not configured on the proxy.",
        },
      };
    }

    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });
    const fields = ["ID", "name", "portfolioPriority", "status"].join(",");
    const query = [
      `portfolioID=${encodeURIComponent(config.portfolioId)}`,
      `fields=${encodeURIComponent(fields)}`,
      "$$LIMIT=100",
    ].join("&");
    const data = await workfrontApi(config, token, `project/search?${query}`);
    const rows = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    const projects = rows
      .map((row) => ({
        ID: String(row.ID || row.id || ""),
        name: String(row.name || ""),
        portfolioPriority:
          row.portfolioPriority != null && Number.isFinite(Number(row.portfolioPriority))
            ? Number(row.portfolioPriority)
            : null,
        status: row.status != null ? String(row.status) : null,
      }))
      .filter((row) => row.ID)
      .sort((a, b) => {
        const ap = a.portfolioPriority ?? Number.MAX_SAFE_INTEGER;
        const bp = b.portfolioPriority ?? Number.MAX_SAFE_INTEGER;
        if (ap !== bp) return ap - bp;
        return a.name.localeCompare(b.name);
      });

    return {
      statusCode: 200,
      headers,
      body: {
        ok: true,
        portfolioId: config.portfolioId,
        count: projects.length,
        projects,
        auth: authLabel(source),
        coverage: `Projects in Workfront portfolio ${config.portfolioId} (TEST PORTFOLIO - CHRIS) via proxy — not organization-wide.`,
      },
    };
  } catch (error) {
    return {
      statusCode: 503,
      headers,
      body: {
        ok: false,
        error: error instanceof Error ? error.message : "Portfolio project list failed.",
        projects: [],
        coverage:
          "Workfront portfolio project search failed. Executive order was not replaced.",
      },
    };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, unknown>} body
 * @param {{ bearerToken?: string }} [options]
 */
async function runApplyPortfolioOrder(env, body, options = {}) {
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
        error: "confirmLive must be true before applying Portfolio Optimization order.",
      },
    };
  }
  if (!config.portfolioId) {
    return {
      statusCode: 400,
      headers,
      body: {
        ok: false,
        error: "WORKFRONT_PORTFOLIO_ID is not set on the proxy.",
      },
    };
  }

  const ordered = Array.isArray(body.orderedProjectIds)
    ? body.orderedProjectIds
    : Array.isArray(body.ranks)
      ? body.ranks
      : null;
  if (!ordered || ordered.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: { ok: false, error: "orderedProjectIds must be a non-empty array." },
    };
  }

  const ranks = buildRanks(ordered);
  try {
    const { token, source } = await resolveAccessToken(config, {
      bearerToken: options.bearerToken,
    });
    /** @type {Array<{ projectId: string, portfolioPriority: number }>} */
    const updated = [];
    for (const rank of ranks) {
      await workfrontApi(config, token, "PROJ", {
        method: "PUT",
        body: {
          ID: rank.projectId,
          portfolioPriority: rank.portfolioPriority,
        },
      });
      updated.push(rank);
    }

    return {
      statusCode: 200,
      headers,
      body: {
        ok: true,
        portfolioId: config.portfolioId,
        count: updated.length,
        ranks: updated,
        auth: authLabel(source),
        coverage: `Applied Portfolio Optimization order (${updated.length} projects) on portfolio ${config.portfolioId}.`,
      },
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: {
        ok: false,
        error:
          error instanceof Error ? error.message : "Portfolio order apply failed.",
      },
    };
  }
}

module.exports = {
  runListPortfolioProjects,
  runApplyPortfolioOrder,
  buildRanks,
};
