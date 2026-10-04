#!/usr/bin/env node
/**
 * Local stand-in for the App Builder Runtime health action.
 *
 * Loads secrets from ../.env.workfront.local (gitignored) or the process environment.
 * Never logs secret values. Same response shape as the Runtime action.
 *
 *   npm start --prefix workfront-proxy
 *   curl -sS http://127.0.0.1:8787/health
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { runHealth } = require("./src/dx-excshell-1/actions/workfront-health/health.js");

const PORT = Number(process.env.WORKFRONT_PROXY_PORT || 8787);
const ENV_FILE = join(__dirname, "..", ".env.workfront.local");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = loadEnvFile(ENV_FILE);
const env = { ...process.env, ...fileEnv };

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  res.end(payload);
}

async function handleHealth(_req, res) {
  const result = await runHealth(env);
  sendJson(res, result.statusCode, result.body);
}

async function once() {
  const result = await runHealth(env);
  process.stdout.write(`${JSON.stringify(result.body, null, 2)}\n`);
  process.exit(result.body.connected ? 0 : 1);
}

if (process.argv.includes("--once")) {
  once().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
} else {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      handleHealth(req, res).catch((error) => {
        sendJson(res, 500, {
          connected: false,
          error: error instanceof Error ? error.message : "Local proxy failure.",
        });
      });
      return;
    }
    sendJson(res, 404, { connected: false, error: "Not found. Use GET /health." });
  });

  server.listen(PORT, "127.0.0.1", () => {
    const hasSecret = Boolean(env.WORKFRONT_CLIENT_SECRET);
    const hasToken = Boolean(env.WORKFRONT_ACCESS_TOKEN);
    console.log(`Workfront proxy listening on http://127.0.0.1:${PORT}/health`);
    console.log(
      `Auth config: client_secret=${hasSecret ? "set" : "missing"}, access_token=${hasToken ? "set" : "missing"}`,
    );
    if (!existsSync(ENV_FILE) && !hasSecret && !hasToken) {
      console.log(`Create ${ENV_FILE} (see workfront-proxy/.env.example).`);
    }
  });
}
