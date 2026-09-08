import * as XLSX from "xlsx";
import {
  EXPORT_HEADERS,
  createRow,
  isPriority,
  type Priority,
  type TrackerRow,
} from "./types";

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<string, keyof TrackerRow | "skip"> = {
  "project deliverables": "project",
  project: "project",
  deliverables: "project",
  "estimated completion date": "estimatedCompletionDate",
  "completion date": "estimatedCompletionDate",
  "estimated completion": "estimatedCompletionDate",
  status: "status",
  "next steps notes": "nextSteps",
  "next steps": "nextSteps",
  notes: "nextSteps",
  misc: "misc",
  miscellaneous: "misc",
  "date created": "createdAt",
  created: "createdAt",
  "created at": "createdAt",
  priority: "priority",
};

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toIsoDateTime(value: unknown, fallback: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(
        Date.UTC(parsed.y, parsed.m - 1, parsed.d),
      ).toISOString();
    }
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

function parsePriority(value: unknown): Priority {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "h" || text === "1") return "high";
  if (text === "l" || text === "3") return "low";
  if (isPriority(text)) return text;
  return "medium";
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function priorityLabel(priority: Priority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function rowToExportArray(row: TrackerRow): string[] {
  return [
    row.project,
    row.estimatedCompletionDate ?? "",
    row.status,
    row.nextSteps,
    row.misc,
    row.createdAt,
    priorityLabel(row.priority),
  ];
}

function workbookFromRows(rows: TrackerRow[]): XLSX.WorkBook {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...EXPORT_HEADERS],
    ...rows.map(rowToExportArray),
  ]);
  sheet["!cols"] = [
    { wch: 32 },
    { wch: 24 },
    { wch: 16 },
    { wch: 36 },
    { wch: 18 },
    { wch: 28 },
    { wch: 12 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Project Tracker");
  return workbook;
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return cleaned || "deliverable";
}

export function parseSpreadsheet(buffer: ArrayBuffer): TrackerRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    { header: 1, defval: "", raw: true },
  );
  if (matrix.length < 2) return [];

  const headerRow = matrix[0] ?? [];
  const columnMap: Array<keyof TrackerRow | null> = headerRow.map((header) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    return key && key !== "skip" ? key : null;
  });

  const now = new Date().toISOString();
  const rows: TrackerRow[] = [];

  for (const line of matrix.slice(1)) {
    const values: Partial<TrackerRow> = {};
    columnMap.forEach((field, index) => {
      if (!field) return;
      const value = line[index];
      if (field === "estimatedCompletionDate") {
        values.estimatedCompletionDate = toIsoDate(value);
      } else if (field === "createdAt") {
        values.createdAt = toIsoDateTime(value, now);
      } else if (field === "priority") {
        values.priority = parsePriority(value);
      } else if (field === "project") {
        values.project = cellText(value);
      } else if (field === "status") {
        values.status = cellText(value);
      } else if (field === "nextSteps") {
        values.nextSteps = cellText(value);
      } else if (field === "misc") {
        values.misc = cellText(value);
      }
    });

    const project = values.project?.trim() ?? "";
    const hasAny =
      project ||
      values.status ||
      values.nextSteps ||
      values.misc ||
      values.estimatedCompletionDate;
    if (!hasAny) continue;

    rows.push(
      createRow({
        ...values,
        project,
        createdAt: values.createdAt ?? now,
        priority: values.priority ?? "medium",
      }),
    );
  }

  return rows;
}

export function downloadWorkbook(rows: TrackerRow[]): void {
  XLSX.writeFile(workbookFromRows(rows), "AAA-Michigan-Project-Tracker.xlsx");
}

export function downloadRow(row: TrackerRow): void {
  const filename = `AAA-Michigan-${slug(row.project)}-${row.createdAt.slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbookFromRows([row]), filename);
}
