/**
 * Unit tests for Brand Team project create/list (decision 055).
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
  WORKFRONT_TEMPLATE_ID: "tmpl-1",
  WORKFRONT_BRAND_PORTFOLIO_ID: "port-brand",
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

test("create fails clearly when template or brand portfolio env is missing", async () => {
  const noTemplate = await runCreateProject(
    { ...BASE_ENV, WORKFRONT_TEMPLATE_ID: "" },
    { name: "x", confirmLive: true },
  );
  assert.equal(noTemplate.statusCode, 502);
  assert.match(noTemplate.body.error, /WORKFRONT_TEMPLATE_ID/);

  const noPortfolio = await runCreateProject(
    { ...BASE_ENV, WORKFRONT_BRAND_PORTFOLIO_ID: "" },
    { name: "x", confirmLive: true },
  );
  assert.equal(noPortfolio.statusCode, 502);
  assert.match(noPortfolio.body.error, /WORKFRONT_BRAND_PORTFOLIO_ID/);
});

test("create posts templateID + portfolioID + description and returns project ids", async () => {
  const stub = stubFetch(() => ({
    status: 200,
    body: { data: { ID: "new-proj", name: "ALAN-1 - Flyer" } },
  }));
  try {
    const result = await runCreateProject(BASE_ENV, {
      name: "ALAN-1 - Flyer",
      description: "Intake summary text",
      confirmLive: true,
    });
    assert.equal(result.statusCode, 201);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.projectId, "new-proj");
    assert.equal(result.body.objectType, "PROJ");
    assert.match(result.body.projectUrl, /project\/view\?ID=new-proj/);

    const post = stub.calls.find((c) => c.method === "POST" && c.url.endsWith("/project"));
    assert.ok(post, "expected POST /project");
    const sent = JSON.parse(String(post.body));
    assert.equal(sent.templateID, "tmpl-1");
    assert.equal(sent.portfolioID, "port-brand");
    assert.equal(sent.description, "Intake summary text");
    assert.equal(JSON.stringify(result.body).includes("test-secret"), false);
  } finally {
    stub.restore();
  }
});

test("create surfaces an ACL error with the runbook pointer", async () => {
  const stub = stubFetch(() => ({
    status: 403,
    body: { error: { message: "You do not have sufficient access to view this Template" } },
  }));
  try {
    const result = await runCreateProject(BASE_ENV, { name: "x", confirmLive: true });
    assert.equal(result.statusCode, 502);
    assert.match(result.body.error, /sufficient access/);
    assert.match(result.body.error, /workfront-brand-project-acl\.md/);
  } finally {
    stub.restore();
  }
});

test("list is scoped to the brand portfolio and names its coverage", async () => {
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
    assert.equal(result.body.portfolioId, "port-brand");
    assert.match(result.body.coverage, /Not organization-wide/);
    const search = stub.calls.find((c) => c.url.includes("project/search"));
    assert.ok(search?.url.includes("portfolioID=port-brand"));
  } finally {
    stub.restore();
  }
});

test("list refuses to run without a brand portfolio id", async () => {
  const result = await runListProjects({ ...BASE_ENV, WORKFRONT_BRAND_PORTFOLIO_ID: "" });
  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body.projects, []);
});

test("health reports whether brand create is configured", async () => {
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
    assert.equal(on.body.brandCreateConfigured, true);
    const off = await runHealth({ ...BASE_ENV, WORKFRONT_TEMPLATE_ID: "" });
    assert.equal(off.body.brandCreateConfigured, false);
  } finally {
    stub.restore();
  }
});

test("health reports Brand portfolio reachable via project search", async () => {
  const stub = stubFetch((url) => {
    if (url.includes("project/search")) {
      return {
        status: 200,
        body: {
          data: [
            { ID: "bp1", name: "Brand One" },
            { ID: "bp2", name: "Brand Two" },
            { ID: "bp3", name: "Brand Three" },
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
    assert.equal(result.body.brandPortfolio.reachable, true);
    assert.equal(result.body.brandPortfolio.id, "port-brand");
    assert.equal(result.body.brandPortfolio.projectCount, 3);
    assert.match(result.body.brandPortfolio.probed, /portfolioID=port-brand/);
    const search = stub.calls.find((c) => c.url.includes("project/search"));
    assert.ok(search, "expected project/search Brand portfolio probe");
  } finally {
    stub.restore();
  }
});

test("health keeps queue project connected when Brand portfolio probe fails", async () => {
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
    assert.equal(result.body.brandPortfolio.reachable, false);
    assert.match(result.body.brandPortfolio.reason, /sufficient access|Workfront API failed/i);
  } finally {
    stub.restore();
  }
});
