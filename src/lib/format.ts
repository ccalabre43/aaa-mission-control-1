import type { Priority } from "./types";

export function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function priorityLabel(priority: Priority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}
