#!/usr/bin/env node
/**
 * SAMPLE Brand Team project create against the local Workfront proxy.
 * Expects WORKFRONT_TEMPLATE_ID + WORKFRONT_BRAND_PORTFOLIO_ID on the proxy env.
 * Never logs secrets. Exit 0 only when ok:true and a Project ID returns.
 *
 *   npm run workfront:sample-project
 */

const BASE = (process.env.WORKFRONT_PROXY_TARGET || "http://127.0.0.1:8787").replace(
  /\/+$/,
  "",
);

const payload = {
  name: "SAMPLE - Mission Control Brand project — delete me",
  description:
    "Automated Brand Team project-create probe from Mission Control. Safe to delete in Workfront. Overview Description should show this text.",
  confirmLive: true,
  customForm: {},
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
    "\nBrand project create still blocked (Template and/or Brand portfolio share). See docs/knowledge/workfront-brand-project-acl.md",
  );
}
process.exit(1);
