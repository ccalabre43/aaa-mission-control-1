import { PRIORITIES, STATUS_OPTIONS, type TrackerRow } from "../lib/types";
import { priorityLabel } from "../lib/format";

type Field = "priority" | "project" | "date" | "status" | "notes";

type RowFieldsProps = {
  row: TrackerRow;
  onChange: (id: string, patch: Partial<TrackerRow>) => void;
  layout: Field;
  labelled?: boolean;
};

export function RowFields({ row, onChange, layout, labelled = false }: RowFieldsProps) {
  const statusChoices = (STATUS_OPTIONS as readonly string[]).includes(row.status)
    ? STATUS_OPTIONS
    : [row.status, ...STATUS_OPTIONS];

  if (layout === "priority") {
    return (
      <label className="block">
        {labelled ? <span className="mb-1 block text-sm font-semibold">Priority</span> : null}
        <select
          className="select select-bordered min-h-11 w-full"
          value={row.priority}
          aria-label={`Priority for ${row.project || "deliverable"}`}
          onChange={(event) =>
            onChange(row.id, {
              priority: event.target.value as TrackerRow["priority"],
            })
          }
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priorityLabel(priority)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (layout === "project") {
    return (
      <label className="block">
        {labelled ? (
          <span className="mb-1 block text-sm font-semibold">Project/Deliverables</span>
        ) : null}
        <input
          className="tracker-input"
          value={row.project}
          aria-label="Project/Deliverables"
          onChange={(event) => onChange(row.id, { project: event.target.value })}
        />
      </label>
    );
  }

  if (layout === "date") {
    return (
      <label className="block">
        {labelled ? (
          <span className="mb-1 block text-sm font-semibold">Estimated Completion Date</span>
        ) : null}
        <input
          type="date"
          className="tracker-input"
          value={row.estimatedCompletionDate ?? ""}
          aria-label="Estimated Completion Date"
          onChange={(event) =>
            onChange(row.id, {
              estimatedCompletionDate: event.target.value || null,
            })
          }
        />
      </label>
    );
  }

  if (layout === "status") {
    return (
      <label className="block">
        {labelled ? <span className="mb-1 block text-sm font-semibold">Status</span> : null}
        <select
          className="select select-bordered min-h-11 w-full"
          value={row.status}
          aria-label="Status"
          onChange={(event) => onChange(row.id, { status: event.target.value })}
        >
          {statusChoices.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block">
      {labelled ? (
        <span className="mb-1 block text-sm font-semibold">Next Steps/Notes</span>
      ) : null}
      <textarea
        className="tracker-input resize-y"
        rows={1}
        value={row.nextSteps}
        aria-label="Next Steps/Notes"
        onChange={(event) => onChange(row.id, { nextSteps: event.target.value })}
      />
    </label>
  );
}
