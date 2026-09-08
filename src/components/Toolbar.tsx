import type { OrderMode } from "../lib/types";

type ToolbarProps = {
  onAdd: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  canExport: boolean;
  orderMode: OrderMode;
  onResort: () => void;
};

export function Toolbar({
  onAdd,
  onImport,
  onExport,
  canExport,
  orderMode,
  onResort,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <button type="button" className="btn btn-primary min-h-11 px-5" onClick={onAdd}>
        Add row
      </button>
      <label className="btn btn-outline btn-secondary min-h-11 px-5 cursor-pointer">
        Import Excel
        <input
          type="file"
          className="sr-only"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
            event.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        className="btn btn-outline btn-secondary min-h-11 px-5"
        onClick={onExport}
        disabled={!canExport}
      >
        Export Excel
      </button>
      {orderMode === "manual" ? (
        <button
          type="button"
          className="btn btn-ghost min-h-11 px-5 underline"
          onClick={onResort}
        >
          Re-sort by priority
        </button>
      ) : null}
    </div>
  );
}
