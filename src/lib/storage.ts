import {
  ORDER_MODE_KEY,
  STORAGE_KEY,
  isPriority,
  type OrderMode,
  type Priority,
  type TrackerRow,
} from "./types";

const BACKUP_KEY = `${STORAGE_KEY}-backup`;

export type LoadStatus = "ok" | "empty" | "recovered" | "unreadable";

export type LoadResult = {
  rows: TrackerRow[];
  status: LoadStatus;
};

export type SaveResult = {
  ok: boolean;
  reason?: string;
};

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function isoDateTime(value: unknown): string {
  const raw = text(value);
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function toPriority(value: unknown): Priority {
  const candidate = text(value).trim().toLowerCase();
  return isPriority(candidate) ? candidate : "medium";
}

/**
 * Repairs a stored row instead of rejecting it. A single unexpected value must
 * never cost the user the row, let alone the whole tracker.
 */
function normalizeRow(value: unknown): TrackerRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const dueDate = text(row.estimatedCompletionDate).trim();
  return {
    id: text(row.id).trim() || crypto.randomUUID(),
    project: text(row.project),
    estimatedCompletionDate: dueDate || null,
    status: text(row.status).trim() || "Not started",
    nextSteps: text(row.nextSteps),
    createdAt: isoDateTime(row.createdAt),
    priority: toPriority(row.priority),
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseRows(raw: string | null): TrackerRow[] | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map(normalizeRow)
      .filter((row): row is TrackerRow => row !== null);
  } catch {
    return null;
  }
}

export function loadRows(): LoadResult {
  const raw = read(STORAGE_KEY);
  const rows = parseRows(raw);
  if (rows) {
    return { rows, status: rows.length > 0 ? "ok" : "empty" };
  }

  const backup = parseRows(read(BACKUP_KEY));
  if (backup && backup.length > 0) {
    return { rows: backup, status: "recovered" };
  }

  return { rows: [], status: raw == null ? "empty" : "unreadable" };
}

export function saveRows(rows: TrackerRow[]): SaveResult {
  const payload = JSON.stringify(rows);
  try {
    if (rows.length > 0) {
      localStorage.setItem(BACKUP_KEY, payload);
    }
    localStorage.setItem(STORAGE_KEY, payload);
    return { ok: true };
  } catch (cause) {
    const quotaHit =
      cause instanceof DOMException &&
      (cause.name === "QuotaExceededError" ||
        cause.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      reason: quotaHit
        ? "This browser's storage is full, so the latest change was not saved. Export to Excel to keep a copy."
        : "This browser is blocking local storage, so changes cannot be saved here. Export to Excel to keep a copy.",
    };
  }
}

export function loadOrderMode(): OrderMode {
  return read(ORDER_MODE_KEY) === "manual" ? "manual" : "auto";
}

export function saveOrderMode(mode: OrderMode): void {
  try {
    localStorage.setItem(ORDER_MODE_KEY, mode);
  } catch {
    /* order preference is not worth surfacing an error for */
  }
}
