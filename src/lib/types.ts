export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_OPTIONS = [
  "Not started",
  "In progress",
  "Blocked",
  "Complete",
] as const;

export type Status = (typeof STATUS_OPTIONS)[number] | string;

export interface TrackerRow {
  id: string;
  project: string;
  estimatedCompletionDate: string | null;
  status: Status;
  nextSteps: string;
  createdAt: string;
  priority: Priority;
}

export const STORAGE_KEY = "aaa-project-tracker";
export const ORDER_MODE_KEY = "aaa-project-tracker-order-mode";

export type OrderMode = "auto" | "manual";

export const EXPORT_HEADERS = [
  "Project/Deliverables",
  "Estimated Completion Date",
  "Status",
  "Next Steps/Notes",
  "Date created",
  "Priority",
] as const;

export function createRow(partial: Partial<TrackerRow> = {}): TrackerRow {
  return {
    id: crypto.randomUUID(),
    project: "",
    estimatedCompletionDate: null,
    status: "Not started",
    nextSteps: "",
    createdAt: new Date().toISOString(),
    priority: "medium",
    ...partial,
  };
}

export function isPriority(value: string): value is Priority {
  return PRIORITIES.includes(value as Priority);
}
