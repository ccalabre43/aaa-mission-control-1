/**
 * Unit tests for TEST PORTFOLIO New Project create/list (decision 057).
 * No network: global fetch is stubbed for IMS + Workfront. Run: npm run test:workfront-projects
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { runCreateProject, runListProjects } = require(
  "../workfront-proxy/src/dx-excshell-1/actions/workfront-projects/projects.js",
);
const { runHealth } = require(
  "../workfront-proxy/src/dx-excshell-1/actions/workfront-health/health.js",
);

const BASE_ENV = {
  WORKFRONT_CLIENT_ID: "test-id",
  WORKFRONT_CLIENT_SECRET: "test-secret",
  WORKFRONT_HOST: "https://wf.example.test",
  WORKFRONT_PROJECT_ID: "proj-queue",
  WORKFRONT_PORTFOLIO_ID: "6aa167f4000304470fb9e879fb8bbd56",
  WORKFRONT_LIVE_SUBMIT: "1",
};

/**
 * @param {(url: string, init: RequestInit) => { status: number, body: unknown }} handler
 */
function stubFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, method: init.method || "GET", body: init.body });
    if (target.includes("/ims/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    const result = handler(target, init);
    return new Response(JSON.stringify(result.body), { status: result.status });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

test("create is rejected when the kill switch is off", async () => {
  const result = await runCreateProject(
    { ...BASE_ENV, WORKFRONT_LIVE_SUBMIT: "0" },
    { name: "x", confirmLive: true },
  );
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.ok, false);
});

test("create is rejected without confirmLive", async () => {
  const result = await runCreateProject(BASE_ENV, { name: "x" });
  assert.equal(result.statusCode, 400);
  assert.match(result.body.error, /confirmLive/);
});

test("create fails clearly when WORKFRONT_PORTFOLIO_ID is missing", async () => {
  const result = await runCreateProject(
    { ...BASE_ENV, WORKFRONT_PORTFOLIO_ID: "" },
    { name: "x", confirmLive: true },
  );
  assert.equal(result.statusCode, 502);
  assert.match(result.body.error, /WORKFRONT_PORTFOLIO_ID/);
});

test("create posts bare name + description + portfolioID without template", async () => {
  const stub = stubFetch(() => ({
    status: 200,
    body: { data: { ID: "new-proj", name: "ALAN-1 - Flyer" } },
  }));
  try {
    const result = await runCreateProject(BASE_ENV, {
      name: "ALAN-1 - Flyer",
      description: "Intake summary text",
      confirmLive: true,
      customForm: { A3IntakeProjectSummary: "should not be posted" },
    });
    assert.equal(result.statusCode, 201);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.projectId, "new-proj");
    assert.equal(result.body.objectType, "PROJ");
    assert.equal(result.body.customFormApplied, false);
    assert.match(result.body.projectUrl, /project\/view\?ID=new-proj/);

    const post = stub.calls.find((c) => c.method === "POST" && c.url.endsWith("/project"));
    assert.ok(post, "expected POST /project");
    const sent = JSON.parse(String(post.body));
    assert.equal(sent.name, "ALAN-1 - Flyer");
    assert.equal(sent.description, "Intake summary text");
    assert.equal(sent.portfolioID, "6aa167f4000304470fb9e879fb8bbd56");
    assert.equal(sent.status, "CUR");
    assert.equal(sent.templateID, undefined);
    assert.equal(sent.parameterValues, undefined);
    assert.equal(JSON.stringify(result.body).includes("test-secret"), false);
  } finally {
    stub.restore();
  }
});

test("create surfaces an ACL error with the TEST PORTFOLIO runbook pointer", async () => {
  const stub = stubFetch(() => ({
    status: 403,
    body: { error: { message: "You do not have sufficient access to create this Project" } },
  }));
  try {
    const result = await runCreateProject(BASE_ENV, { name: "x", confirmLive: true });
    assert.equal(result.statusCode, 502);
    assert.match(result.body.error, /sufficient access/);
    assert.match(result.body.error, /workfront-test-portfolio-acl\.md/);
  } finally {
    stub.restore();
  }
});

test("list is scoped to TEST PORTFOLIO and names its coverage", async () => {
  const stub = stubFetch(() => ({
    status: 200,
    body: {
      data: [
        { ID: "p1", name: "One", status: "PLN", owner: { name: "Chris" } },
        { ID: "p2", name: "Two", status: "CUR" },
      ],
    },
  }));
  try {
    const result = await runListProjects(BASE_ENV);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.count, 2);
    assert.equal(result.body.portfolioId, "6aa167f4000304470fb9e879fb8bbd56");
    assert.match(result.body.coverage, /TEST PORTFOLIO/);
    assert.match(result.body.coverage, /Not organization-wide/);
    const search = stub.calls.find((c) => c.url.includes("project/search"));
    assert.ok(search?.url.includes("portfolioID=6aa167f4000304470fb9e879fb8bbd56"));
  } finally {
    stub.restore();
  }
});

test("list refuses to run without a portfolio id", async () => {
  const result = await runListProjects({ ...BASE_ENV, WORKFRONT_PORTFOLIO_ID: "" });
  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body.projects, []);
});

test("health reports projectCreateConfigured from WORKFRONT_PORTFOLIO_ID", async () => {
  const stub = stubFetch((url) => {
    if (url.includes("project/search")) {
      return {
        status: 200,
        body: { data: [{ ID: "p1", name: "One" }] },
      };
    }
    return {
      status: 200,
      body: { data: { ID: "proj-queue", name: "mission-control-v1" } },
    };
  });
  try {
    const on = await runHealth(BASE_ENV);
    assert.equal(on.body.projectCreateConfigured, true);
    assert.equal(on.body.brandCreateConfigured, true);
    const off = await runHealth({ ...BASE_ENV, WORKFRONT_PORTFOLIO_ID: "" });
    assert.equal(off.body.projectCreateConfigured, false);
  } finally {
    stub.restore();
  }
});

test("health reports TEST PORTFOLIO reachable via project search", async () => {
  const stub = stubFetch((url) => {
    if (url.includes("project/search")) {
      return {
        status: 200,
        body: {
          data: [
            { ID: "tp1", name: "One" },
            { ID: "tp2", name: "Two" },
            { ID: "tp3", name: "Three" },
          ],
        },
      };
    }
    return {
      status: 200,
      body: { data: { ID: "proj-queue", name: "mission-control-v1" } },
    };
  });
  try {
    const result = await runHealth(BASE_ENV);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.connected, true);
    assert.equal(result.body.createPortfolio.reachable, true);
    assert.equal(result.body.createPortfolio.id, "6aa167f4000304470fb9e879fb8bbd56");
    assert.equal(result.body.createPortfolio.projectCount, 3);
    assert.match(result.body.createPortfolio.probed, /portfolioID=6aa167f4000304470fb9e879fb8bbd56/);
  } finally {
    stub.restore();
  }
});

test("health keeps queue project connected when create portfolio probe fails", async () => {
  const stub = stubFetch((url) => {
    if (url.includes("project/search")) {
      return {
        status: 403,
        body: { error: { message: "You do not have sufficient access to view this Portfolio" } },
      };
    }
    return {
      status: 200,
      body: { data: { ID: "proj-queue", name: "mission-control-v1" } },
    };
  });
  try {
    const result = await runHealth(BASE_ENV);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.connected, true);
    assert.equal(result.body.project.name, "mission-control-v1");
    assert.equal(result.body.createPortfolio.reachable, false);
    assert.match(result.body.createPortfolio.reason, /sufficient access|Workfront API failed/i);
  } finally {
    stub.restore();
  }
});
