/**
 * Unit tests for Priority urgency map and Portfolio Optimization ranks.
 * Keep map helpers in sync with src/lib/workfront/priorityMap.ts.
 *
 * Run: npm run test:workfront-priority
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** @param {"P1"|"P2"|"P3"} priority */
function toWorkfrontPriority(priority) {
  if (priority === "P1") return 1;
  if (priority === "P3") return 4;
  return 2;
}

/** @param {string | null} raw */
function mapWorkfrontPriority(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const key = String(raw).trim().toLowerCase();
  if (key === "1" || key.includes("urgent") || key.includes("highest")) return "P1";
  if (key === "2" || key === "3" || key.includes("high")) return "P2";
  if (
    key === "4" ||
    key === "6" ||
    key === "7" ||
    key === "8" ||
    key === "9" ||
    key.includes("low")
  ) {
    return "P3";
  }
  if (key === "5" || key.includes("normal") || key.includes("medium")) return "P2";
  return null;
}

/** @param {string[]} orderedProjectIds */
function buildPortfolioRanks(orderedProjectIds) {
  return orderedProjectIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((projectId, index) => ({
      projectId,
      portfolioPriority: index + 1,
    }));
}

const { runUpdateTaskPriority } = require(
  join(__dirname, "../workfront-proxy/src/dx-excshell-1/actions/workfront-issues/updatePriority.js"),
);
const { buildRanks, runApplyPortfolioOrder } = require(
  join(__dirname, "../workfront-proxy/src/dx-excshell-1/actions/workfront-portfolio/portfolio.js"),
);

test("toWorkfrontPriority maps P1/P2/P3 to 1/2/4", () => {
  assert.equal(toWorkfrontPriority("P1"), 1);
  assert.equal(toWorkfrontPriority("P2"), 2);
  assert.equal(toWorkfrontPriority("P3"), 4);
});

test("mapWorkfrontPriority round-trips provisional values", () => {
  assert.equal(mapWorkfrontPriority("1"), "P1");
  assert.equal(mapWorkfrontPriority("2"), "P2");
  assert.equal(mapWorkfrontPriority("4"), "P3");
  assert.equal(mapWorkfrontPriority(String(toWorkfrontPriority("P1"))), "P1");
  assert.equal(mapWorkfrontPriority(String(toWorkfrontPriority("P2"))), "P2");
  assert.equal(mapWorkfrontPriority(String(toWorkfrontPriority("P3"))), "P3");
});

test("buildPortfolioRanks builds contiguous 1..n", () => {
  assert.deepEqual(buildPortfolioRanks(["a", " b ", "", "c"]), [
    { projectId: "a", portfolioPriority: 1 },
    { projectId: "b", portfolioPriority: 2 },
    { projectId: "c", portfolioPriority: 3 },
  ]);
  assert.deepEqual(buildRanks(["x", "y"]), [
    { projectId: "x", portfolioPriority: 1 },
    { projectId: "y", portfolioPriority: 2 },
  ]);
});

test("runUpdateTaskPriority rejects without confirmLive / kill switch", async () => {
  const off = await runUpdateTaskPriority(
    { WORKFRONT_LIVE_SUBMIT: "0" },
    { taskId: "t1", priority: 1, confirmLive: true },
  );
  assert.equal(off.statusCode, 403);
  assert.equal(off.body.ok, false);

  const noConfirm = await runUpdateTaskPriority(
    { WORKFRONT_LIVE_SUBMIT: "1" },
    { taskId: "t1", priority: 1 },
  );
  assert.equal(noConfirm.statusCode, 400);
  assert.match(String(noConfirm.body.error), /confirmLive/);

  const badPriority = await runUpdateTaskPriority(
    { WORKFRONT_LIVE_SUBMIT: "1" },
    { taskId: "t1", priority: 9, confirmLive: true },
  );
  assert.equal(badPriority.statusCode, 400);
});

test("runApplyPortfolioOrder rejects without confirmLive / kill switch / ids", async () => {
  const off = await runApplyPortfolioOrder(
    { WORKFRONT_LIVE_SUBMIT: "0", WORKFRONT_PORTFOLIO_ID: "port1" },
    { orderedProjectIds: ["a"], confirmLive: true },
  );
  assert.equal(off.statusCode, 403);

  const noConfirm = await runApplyPortfolioOrder(
    { WORKFRONT_LIVE_SUBMIT: "1", WORKFRONT_PORTFOLIO_ID: "port1" },
    { orderedProjectIds: ["a"] },
  );
  assert.equal(noConfirm.statusCode, 400);

  const noPortfolio = await runApplyPortfolioOrder(
    { WORKFRONT_LIVE_SUBMIT: "1" },
    { orderedProjectIds: ["a"], confirmLive: true },
  );
  assert.equal(noPortfolio.statusCode, 400);

  const empty = await runApplyPortfolioOrder(
    { WORKFRONT_LIVE_SUBMIT: "1", WORKFRONT_PORTFOLIO_ID: "port1" },
    { orderedProjectIds: [], confirmLive: true },
  );
  assert.equal(empty.statusCode, 400);
});
