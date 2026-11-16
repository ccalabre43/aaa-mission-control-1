#!/usr/bin/env node
/**
 * SAMPLE New Project from Email Creative template against the local Workfront proxy
 * (TEST PORTFOLIO - CHRIS). Expects WORKFRONT_PORTFOLIO_ID + WORKFRONT_LIVE_SUBMIT=1
 * (WORKFRONT_TEMPLATE_ID defaults to BIM Email Creative TMPL).
 * Never logs secrets. Exit 0 only when ok:true and a Project ID returns.
 *
 *   npm run workfront:sample-project
 */

const BASE = (process.env.WORKFRONT_PROXY_TARGET || "http://127.0.0.1:8787").replace(
  /\/+$/,
  "",
);

const payload = {
  name: "SAMPLE - Mission Control New Project — delete me",
  description:
    "Automated TEST PORTFOLIO New Project probe from Mission Control. Safe to delete in Workfront.\n\n---\n\nProject Summary\nSample create from Mission Control\n\nBackground / Purpose\nOverview Description should show this labeled intake block intact.",
  confirmLive: true,
};

const response = await fetch(`${BASE}/projects`, {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
let data;
try {
  data = text ? JSON.parse(text) : {};
} catch {
  console.error(`Proxy returned non-JSON (HTTP ${response.status}).`);
  process.exit(1);
}

const summary = {
  ok: data.ok === true,
  projectId:
    typeof data.projectId === "string"
      ? data.projectId
      : typeof data.ID === "string"
        ? data.ID
        : undefined,
  name: typeof data.name === "string" ? data.name : undefined,
  projectUrl:
    typeof data.projectUrl === "string"
      ? data.projectUrl
      : typeof data.url === "string"
        ? data.url
        : undefined,
  portfolioID: typeof data.portfolioID === "string" ? data.portfolioID : undefined,
  templateID: typeof data.templateID === "string" ? data.templateID : undefined,
  placement:
    data.placement && typeof data.placement === "object" ? data.placement : undefined,
  workstart:
    data.workstart && typeof data.workstart === "object" ? data.workstart : undefined,
  auth: typeof data.auth === "string" ? data.auth : undefined,
  objectType: typeof data.objectType === "string" ? data.objectType : undefined,
  error: typeof data.error === "string" ? data.error : undefined,
  httpStatus: response.status,
};

console.log(JSON.stringify(summary, null, 2));

if (summary.ok && summary.projectId) {
  process.exit(0);
}

if (summary.error && /sufficient access/i.test(summary.error)) {
  console.error(
    "\nNew Project create still blocked (TEST PORTFOLIO Manage share). See docs/knowledge/workfront-test-portfolio-acl.md",
  );
}
process.exit(1);
