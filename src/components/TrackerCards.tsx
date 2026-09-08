import type { TrackerRow } from "../lib/types";
import { formatCreatedAt, priorityLabel } from "../lib/format";
import { RowFields } from "./RowFields";

type TrackerCardsProps = {
  rows: TrackerRow[];
  onChange: (id: string, patch: Partial<TrackerRow>) => void;
  onExportRow: (row: TrackerRow) => void;
  onRequestDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
};

export function TrackerCards({
  rows,
  onChange,
  onExportRow,
  onRequestDelete,
  onMove,
}: TrackerCardsProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[#dddddd] bg-white px-4 py-16 text-center md:hidden">
        No deliverables yet. Add one or import an Excel file.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4 md:hidden">
      {rows.map((row, index) => {
        const title = row.project.trim() || "Untitled deliverable";
        return (
          <li
            key={row.id}
            data-row-id={row.id}
            className={`rounded-md border border-[#dddddd] bg-white p-4 ${
              row.priority === "high" ? "border-l-4 border-l-primary" : ""
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Priority: {priorityLabel(row.priority)}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="tracker-handle"
                  aria-label={`Move ${title} up, row ${index + 1} of ${rows.length}`}
                  disabled={index === 0}
                  onClick={() => onMove(row.id, -1)}
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  className="tracker-handle"
                  aria-label={`Move ${title} down, row ${index + 1} of ${rows.length}`}
                  disabled={index === rows.length - 1}
                  onClick={() => onMove(row.id, 1)}
                >
                  <span aria-hidden="true">↓</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <RowFields row={row} onChange={onChange} layout="project" labelled />
              <p>
                <span className="mb-1 block text-sm font-semibold">Date created</span>
                <time dateTime={row.createdAt}>{formatCreatedAt(row.createdAt)}</time>
              </p>
              <RowFields row={row} onChange={onChange} layout="date" labelled />
              <RowFields row={row} onChange={onChange} layout="status" labelled />
              <RowFields row={row} onChange={onChange} layout="notes" labelled />
              <RowFields row={row} onChange={onChange} layout="priority" labelled />
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button
                  type="button"
                  className="btn btn-outline btn-secondary min-h-11"
                  onClick={() => onExportRow(row)}
                >
                  Export this row
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-error min-h-11"
                  onClick={() => onRequestDelete(row.id)}
                >
                  Delete {title}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
