import {
  ORDER_MODE_KEY,
  STORAGE_KEY,
  isPriority,
  type OrderMode,
  type TrackerRow,
} from "./types";

function isRow(value: unknown): value is TrackerRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.project === "string" &&
    (row.estimatedCompletionDate === null ||
      typeof row.estimatedCompletionDate === "string") &&
    typeof row.status === "string" &&
    typeof row.nextSteps === "string" &&
    typeof row.misc === "string" &&
    typeof row.createdAt === "string" &&
    typeof row.priority === "string" &&
    isPriority(row.priority)
  );
}

export function loadRows(): TrackerRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRow);
  } catch {
    return [];
  }
}

export function saveRows(rows: TrackerRow[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function loadOrderMode(): OrderMode {
  return localStorage.getItem(ORDER_MODE_KEY) === "manual" ? "manual" : "auto";
}

export function saveOrderMode(mode: OrderMode): void {
  localStorage.setItem(ORDER_MODE_KEY, mode);
}
