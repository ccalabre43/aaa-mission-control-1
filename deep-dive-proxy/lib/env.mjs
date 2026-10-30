/**
 * Load gitignored ../.env.deep-dive.local into a plain object. Never log secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ENV_FILE = join(__dirname, "..", "..", ".env.deep-dive.local");

export function loadEnvFile(path = ENV_FILE) {
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

export function mergeEnv(fileEnv = loadEnvFile()) {
  return { ...process.env, ...fileEnv };
}

export function liveWriteEnabled(env) {
  return String(env.DEEP_DIVE_LIVE_WRITE || "").trim() === "1";
}
