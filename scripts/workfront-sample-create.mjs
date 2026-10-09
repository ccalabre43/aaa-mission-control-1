#!/usr/bin/env node
/**
 * SAMPLE Task create against the local Workfront proxy (mission-control-v1).
 * Never logs secrets. Exit 0 only when ok:true and a Task ID returns.
 *
 *   npm run workfront:sample-create
 */

const BASE = (process.env.WORKFRONT_PROXY_TARGET || "http://127.0.0.1:8787").replace(
  /\/+$/,
  "",
);

const payload = {
  name: "SAMPLE Mission Control connection test — delete me",
  description:
    "Automated connection check from Mission Control. Safe to delete in Workfront.",
  projectID: "6abae2b600041e3ecb6a8da4dbe7b4a1",
  confirmLive: true,
  customForm: {},
};

const response = await fetch(`${BASE}/issues`, {
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
  ID: typeof data.ID === "string" ? data.ID : undefined,
  name: typeof data.name === "string" ? data.name : undefined,
  url: typeof data.url === "string" ? data.url : undefined,
  auth: typeof data.auth === "string" ? data.auth : undefined,
  objectType: typeof data.objectType === "string" ? data.objectType : undefined,
  error: typeof data.error === "string" ? data.error : undefined,
  httpStatus: response.status,
};

console.log(JSON.stringify(summary, null, 2));

if (summary.ok && summary.ID) {
  process.exit(0);
}

if (summary.error && /sufficient access/i.test(summary.error)) {
  console.error(
    "\nTask create still blocked (Access Level and/or project Share). See docs/knowledge/workfront-add-tasks-acl.md",
  );
}
process.exit(1);
