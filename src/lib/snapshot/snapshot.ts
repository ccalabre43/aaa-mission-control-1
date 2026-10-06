/**
 * Local saved versions of the Request Queue: a whole-queue snapshot written to a file, and read back.
 *
 * Why a file rather than another `localStorage` key. Every existing safety net in this app - the
 * backup key beside each primary key, the repair-not-reject parse - protects against a bad *value*.
 * None of them protects against losing the *origin*, and that is the failure that actually happens:
 * `localStorage` is scoped to scheme, host, and port, so dev and preview were two separate stores,
 * and "clear site data" takes a primary key and its backup together. A snapshot that lives outside
 * the browser is the only version of this that survives any of that.
 *
 * Deliberately not a Workfront substitute. Nothing here transmits, and a snapshot is not a shared
 * record - two people with two files have two unrelated truths. This exists to keep work intact while
 * the real queue is unavailable, and it should be retired rather than extended once it is not.
 *
 * ## The file contains PII
 *
 * A faithful snapshot cannot avoid it. Requester first name, last name, email, and department live
 * inside each brief's `identity` and again in its assembled `A3IntakeRequestedBy`, so stripping them
 * would break the fidelity the snapshot exists to provide. Three consequences, all load-bearing:
 *
 * - `aaa-intake-identity` is **excluded**. It is the requester's own saved details, kept only to save
 *   retyping, and reproducing the queue does not need it - each brief already carries its own
 *   requester. Leaving it out is real minimization rather than a gesture.
 * - The file must not be committed. `assets/exports/*` is already gitignored for exactly this reason.
 * - Sharing one is a privacy decision under guardrail 5, not a convenience. The UI says so.
 */
import {
  BRIEF_STORAGE_KEY,
  QUESTION_REGISTRY_KEY,
  RECENT_ALAN_KEY,
} from "../intake/types";
import { QUEUE_CONFIG_KEY } from "../workfront/queueConfig";
import { ORDER_MODE_KEY, STORAGE_KEY as TRACKER_KEY } from "../types";

/**
 * Bumped only when a stored shape changes in a way a reader cannot infer.
 *
 * The point is not migration - `normalizeBrief` and its siblings already repair an older record on
 * read. The point is that an *older reader* must refuse a *newer* file instead of silently dropping
 * fields it has no concept of, which would look like a successful restore and quietly lose data.
 */
export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_FORMAT = "aaa-mission-control-queue-snapshot";

/** Where a pre-import copy goes, so an import is undoable. */
const ROLLBACK_KEY = "aaa-snapshot-rollback";

/**
 * Exactly what a snapshot carries, and what each key is for.
 *
 * Enumerated rather than "every `aaa-` key" on purpose. A wildcard would have swept up
 * `aaa-intake-identity` the moment someone added it, which is the one key deliberately excluded.
 */
const CAPTURED_KEYS: ReadonlyArray<{ key: string; why: string }> = [
  { key: BRIEF_STORAGE_KEY, why: "The requests themselves" },
  { key: QUEUE_CONFIG_KEY, why: "Queue topics, topic groups, and routing rules" },
  { key: QUESTION_REGISTRY_KEY, why: "The guided question set the requests were captured with" },
  { key: RECENT_ALAN_KEY, why: "Recently used ALAN numbers" },
  { key: TRACKER_KEY, why: "The project tracker's rows" },
  { key: ORDER_MODE_KEY, why: "The tracker's sort preference" },
];

/**
 * Named so the omission is visible in the file itself rather than only in this comment.
 *
 * A reader who finds no requester identity in a snapshot should be able to tell that it was left out
 * on purpose, not that the export was broken.
 */
const OMITTED_KEYS: ReadonlyArray<{ key: string; why: string }> = [
  {
    key: "aaa-intake-identity",
    why: "The requester's own saved name and email. PII, and not needed to reproduce the queue - each request carries its own requester.",
  },
  {
    key: "aaa-dashboard-cards",
    why: "Home dashboard layout. A display preference, not queue data.",
  },
  {
    key: "aaa-intake-briefs-backup",
    why: "Derived from the requests above. Restoring it would only duplicate them.",
  },
];

export interface SnapshotMeta {
  format: string;
  schemaVersion: number;
  createdAt: string;
  /**
   * The origin the snapshot came from. Recorded because origin is what separates one store from
   * another, so "this came from localhost:4173" is often the whole explanation for a surprise.
   */
  origin: string;
  appVersion: string;
  /** Human-readable counts, so the file can be sanity-checked without importing it. */
  counts: Record<string, number>;
  captured: ReadonlyArray<{ key: string; why: string }>;
  omitted: ReadonlyArray<{ key: string; why: string }>;
  /** Stated in the file, since the file itself is the thing that travels. */
  privacyNote: string;
}

export interface QueueSnapshot {
  meta: SnapshotMeta;
  /** Raw stored strings, keyed by storage key. Parsed on import by the existing loaders. */
  data: Record<string, string>;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Counts without committing to a shape, so a future key needs no change here. */
function countOf(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === "object") return Object.keys(parsed).length;
    return 1;
  } catch {
    return 0;
  }
}

export function buildSnapshot(): QueueSnapshot {
  const data: Record<string, string> = {};
  const counts: Record<string, number> = {};

  for (const { key } of CAPTURED_KEYS) {
    const raw = readKey(key);
    // An absent key is omitted rather than written as "null", so an import can tell "there was
    // nothing here" from "there was something and it was empty".
    if (raw !== null) {
      data[key] = raw;
      counts[key] = countOf(raw);
    }
  }

  return {
    meta: {
      format: SNAPSHOT_FORMAT,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      origin: typeof location === "undefined" ? "unknown" : location.origin,
      appVersion: "sprint-1",
      counts,
      captured: CAPTURED_KEYS,
      omitted: OMITTED_KEYS,
      privacyNote:
        "This file contains requester names, email addresses, and departments, which are PII. Keep it on your own device. Do not commit it to a repository, and treat sharing it as a privacy decision rather than a convenience.",
    },
    data,
  };
}

/** Indented, because a snapshot people are asked to trust should be readable in a text editor. */
export function serializeSnapshot(snapshot: QueueSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function snapshotFileName(now = new Date()): string {
  // Colons are illegal in Windows filenames and were a real failure in this project's own folder
  // naming, so the ISO timestamp is flattened rather than used as-is.
  const stamp = now.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  return `mission-control-queue-${stamp}.json`;
}

export type ParseOutcome =
  | { ok: true; snapshot: QueueSnapshot; warnings: string[] }
  | { ok: false; reason: string };

/**
 * Validates the envelope before anything is written.
 *
 * Refuses rather than salvages. A snapshot is restored over live data, so a half-understood file is
 * the one case where doing nothing is clearly better than doing something - the opposite of the
 * repair-not-reject rule that governs reading a single record.
 */
export function parseSnapshot(text: string): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That file is not valid JSON, so it was not read." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "That file does not contain a snapshot object." };
  }

  const candidate = parsed as Partial<QueueSnapshot>;
  const meta = candidate.meta;
  if (!meta || typeof meta !== "object") {
    return {
      ok: false,
      reason: "That file has no snapshot header, so there is no way to tell what it is.",
    };
  }
  if (meta.format !== SNAPSHOT_FORMAT) {
    return {
      ok: false,
      reason: `That file is not a Mission Control queue snapshot (its format says "${String(meta.format)}").`,
    };
  }
  if (typeof meta.schemaVersion !== "number") {
    return { ok: false, reason: "That snapshot does not say which schema version it is." };
  }
  if (meta.schemaVersion > SNAPSHOT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `That snapshot was written by a newer version of this app (schema ${meta.schemaVersion}, this app reads ${SNAPSHOT_SCHEMA_VERSION}). Importing it could drop data this version does not understand, so it was refused.`,
    };
  }
  if (!candidate.data || typeof candidate.data !== "object") {
    return { ok: false, reason: "That snapshot has a header but no data." };
  }

  const warnings: string[] = [];
  const data: Record<string, string> = {};
  const known = new Set(CAPTURED_KEYS.map((entry) => entry.key));

  for (const [key, value] of Object.entries(candidate.data)) {
    if (typeof value !== "string") {
      warnings.push(`Skipped "${key}": its value was not stored text.`);
      continue;
    }
    if (!known.has(key)) {
      // Refusing the whole file over one unrecognized key would make a snapshot from a slightly
      // different build unusable, so this is a warning rather than a rejection.
      warnings.push(`Skipped "${key}": this version does not use that key.`);
      continue;
    }
    try {
      JSON.parse(value);
    } catch {
      warnings.push(`Skipped "${key}": its contents could not be read.`);
      continue;
    }
    data[key] = value;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, reason: "Nothing in that snapshot could be read, so nothing was changed." };
  }

  return {
    ok: true,
    snapshot: { meta: meta as SnapshotMeta, data },
    warnings,
  };
}

export interface ApplyResult {
  restoredKeys: string[];
  failedKeys: string[];
  /** True when the pre-import copy was stored, so Undo can be offered honestly. */
  rollbackStored: boolean;
}

/**
 * Replaces the captured keys with the snapshot's values.
 *
 * Replace, not merge. Merging by id sounds friendlier and is a trap: two snapshots from two origins
 * carry different records under ids that were generated independently, so a merge produces a queue
 * that never existed anywhere, with no way to tell which half came from where. Replace is at least a
 * state that was real, and `rollback()` makes it reversible.
 *
 * A key present in the snapshot but empty is still written, because "this queue had no requests" is
 * a real state to restore. A key absent from the snapshot is left alone.
 */
export function applySnapshot(snapshot: QueueSnapshot): ApplyResult {
  const rollbackStored = writeKey(ROLLBACK_KEY, serializeSnapshot(buildSnapshot()));

  const restoredKeys: string[] = [];
  const failedKeys: string[] = [];
  for (const [key, value] of Object.entries(snapshot.data)) {
    if (writeKey(key, value)) restoredKeys.push(key);
    else failedKeys.push(key);
  }
  return { restoredKeys, failedKeys, rollbackStored };
}

export function hasRollback(): boolean {
  return readKey(ROLLBACK_KEY) !== null;
}

/**
 * Restores the pre-import state.
 *
 * Single-depth on purpose: undoing an undo would need a stack, and a stack of whole-queue states in
 * `localStorage` is a quota problem waiting to happen. One step back covers the mistake this is for.
 */
export function rollback(): ApplyResult | null {
  const raw = readKey(ROLLBACK_KEY);
  if (raw === null) return null;
  const outcome = parseSnapshot(raw);
  if (!outcome.ok) return null;

  const restoredKeys: string[] = [];
  const failedKeys: string[] = [];

  // Keys captured then, absent now, must be cleared rather than left behind - otherwise undoing an
  // import leaves whatever the import added still sitting there.
  for (const { key } of CAPTURED_KEYS) {
    const value = outcome.snapshot.data[key];
    if (value === undefined) {
      try {
        localStorage.removeItem(key);
      } catch {
        failedKeys.push(key);
      }
      continue;
    }
    if (writeKey(key, value)) restoredKeys.push(key);
    else failedKeys.push(key);
  }

  try {
    localStorage.removeItem(ROLLBACK_KEY);
  } catch {
    /* nothing useful to do if storage is blocked */
  }
  return { restoredKeys, failedKeys, rollbackStored: false };
}

/**
 * Triggers the download.
 *
 * An anchor with an object URL, not a `connect-src` request: nothing leaves the device, and this stays
 * inside the strict CSP with no directive added. The URL is revoked so the blob is not held for the
 * life of the tab.
 */
export function downloadSnapshot(snapshot: QueueSnapshot): string {
  const fileName = snapshotFileName(new Date(snapshot.meta.createdAt));
  const blob = new Blob([serializeSnapshot(snapshot)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return fileName;
}

/** Plain-language summary of what an import actually did, for the status line. */
export function describeSnapshot(meta: SnapshotMeta): string {
  const requests = meta.counts[BRIEF_STORAGE_KEY] ?? 0;
  const rows = meta.counts[TRACKER_KEY] ?? 0;
  const when = new Date(meta.createdAt);
  const stamp = Number.isNaN(when.getTime())
    ? "an unknown date"
    : when.toLocaleString();
  return `${requests} request${requests === 1 ? "" : "s"} and ${rows} tracker row${
    rows === 1 ? "" : "s"
  }, saved ${stamp} from ${meta.origin}`;
}
