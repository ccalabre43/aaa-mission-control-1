import type { Priority, TrackerRow } from "./types";

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortRows(rows: TrackerRow[]): TrackerRow[] {
  return [...rows].sort((a, b) => {
    const byPriority =
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (byPriority !== 0) return byPriority;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
