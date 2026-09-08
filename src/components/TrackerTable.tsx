import { useState } from "react";
import type { OrderMode, TrackerRow } from "../lib/types";
import { formatCreatedAt } from "../lib/format";
import { RowFields } from "./RowFields";

type TrackerTableProps = {
  rows: TrackerRow[];
  orderMode: OrderMode;
  onChange: (id: string, patch: Partial<TrackerRow>) => void;
  onExportRow: (row: TrackerRow) => void;
  onRequestDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onReorder: (draggedId: string, targetId: string) => void;
};

export function TrackerTable({
  rows,
  orderMode,
  onChange,
  onExportRow,
  onRequestDelete,
  onMove,
  onReorder,
}: TrackerTableProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);

  function endDrag() {
    setDraggingId(null);
    setDragOverId(null);
    setGrabbedId(null);
  }

  return (
    <div className="hidden overflow-x-auto rounded-md border border-[#dddddd] bg-white md:block">
      <table className="table table-pin-rows">
        <caption className="sr-only">
          {orderMode === "auto"
            ? "Project deliverables sorted by priority, then date created"
            : "Project deliverables in a custom order you set"}
        </caption>
        <thead>
          <tr className="bg-[#eaeaea] text-[#222222]">
            <th scope="col" className="w-14">
              <span className="sr-only">Reorder row</span>
            </th>
            <th scope="col" className="min-w-[16rem]">
              Project/Deliverables
            </th>
            <th scope="col" className="min-w-[11rem]">
              Date created
            </th>
            <th scope="col" className="min-w-[12rem]">
              Estimated Completion Date
            </th>
            <th scope="col" className="min-w-[11rem]">
              Status
            </th>
            <th scope="col" className="min-w-[16rem]">
              Next Steps/Notes
            </th>
            <th scope="col" className="min-w-[10rem]">
              Misc.
            </th>
            <th scope="col" className="min-w-[8.5rem]">
              Priority
            </th>
            <th scope="col" className="w-16">
              <span className="sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-16 text-center text-[#222222]">
                No deliverables yet. Add one or import an Excel file.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.id}
                data-row-id={row.id}
                draggable={grabbedId === row.id}
                onDragStart={(event) => {
                  setDraggingId(row.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", row.id);
                }}
                onDragOver={(event) => {
                  if (!draggingId || draggingId === row.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverId(row.id);
                }}
                onDragLeave={() => {
                  setDragOverId((current) => (current === row.id ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = draggingId ?? event.dataTransfer.getData("text/plain");
                  if (id && id !== row.id) onReorder(id, row.id);
                  endDrag();
                }}
                onDragEnd={endDrag}
                className={[
                  row.priority === "high"
                    ? "border-l-4 border-l-primary"
                    : "border-l-4 border-l-transparent",
                  draggingId === row.id ? "opacity-50" : "",
                  dragOverId === row.id ? "tracker-row-target" : "",
                ].join(" ")}
              >
                <td>
                  <DragHandle
                    row={row}
                    index={index}
                    total={rows.length}
                    onMove={onMove}
                    onGrab={setGrabbedId}
                  />
                </td>
                <td>
                  <RowFields row={row} onChange={onChange} layout="project" />
                </td>
                <td>
                  <time dateTime={row.createdAt}>{formatCreatedAt(row.createdAt)}</time>
                </td>
                <td>
                  <RowFields row={row} onChange={onChange} layout="date" />
                </td>
                <td>
                  <RowFields row={row} onChange={onChange} layout="status" />
                </td>
                <td>
                  <RowFields row={row} onChange={onChange} layout="notes" />
                </td>
                <td>
                  <RowFields row={row} onChange={onChange} layout="misc" />
                </td>
                <td>
                  <RowFields row={row} onChange={onChange} layout="priority" />
                </td>
                <td>
                  <RowActions
                    row={row}
                    index={index}
                    total={rows.length}
                    onExportRow={onExportRow}
                    onRequestDelete={onRequestDelete}
                    onMove={onMove}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DragHandle({
  row,
  index,
  total,
  onMove,
  onGrab,
}: {
  row: TrackerRow;
  index: number;
  total: number;
  onMove: (id: string, direction: -1 | 1) => void;
  onGrab: (id: string | null) => void;
}) {
  const label = row.project.trim() || "Untitled deliverable";

  return (
    <button
      type="button"
      className="tracker-handle"
      title="Drag to reorder, or press the up or down arrow key"
      aria-label={`Reorder ${label}, row ${index + 1} of ${total}. Press the up or down arrow key to move it.`}
      onPointerDown={() => onGrab(row.id)}
      onPointerUp={() => onGrab(null)}
      onBlur={() => onGrab(null)}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onMove(row.id, -1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onMove(row.id, 1);
        }
      }}
    >
      <span aria-hidden="true">⣿</span>
    </button>
  );
}

function RowActions({
  row,
  index,
  total,
  onExportRow,
  onRequestDelete,
  onMove,
}: {
  row: TrackerRow;
  index: number;
  total: number;
  onExportRow: (row: TrackerRow) => void;
  onRequestDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const label = row.project.trim() || "Untitled deliverable";

  function close(event: React.MouseEvent<HTMLButtonElement>) {
    const details = event.currentTarget.closest("details");
    if (details) details.open = false;
  }

  return (
    <details className="dropdown dropdown-end">
      <summary
        className="btn btn-ghost btn-square min-h-11 min-w-11"
        aria-label={`Actions for ${label}`}
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ⋯
        </span>
      </summary>
      <ul className="menu dropdown-content z-20 w-56 rounded-md border border-[#dddddd] bg-white p-2 shadow">
        <li>
          <button
            type="button"
            disabled={index === 0}
            onClick={(event) => {
              onMove(row.id, -1);
              close(event);
            }}
          >
            Move up
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={(event) => {
              onMove(row.id, 1);
              close(event);
            }}
          >
            Move down
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={(event) => {
              onExportRow(row);
              close(event);
            }}
          >
            Export this row
          </button>
        </li>
        <li>
          <button
            type="button"
            className="text-error"
            onClick={(event) => {
              onRequestDelete(row.id);
              close(event);
            }}
          >
            Delete
          </button>
        </li>
      </ul>
    </details>
  );
}
