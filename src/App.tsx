import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Toolbar } from "./components/Toolbar";
import { TrackerTable } from "./components/TrackerTable";
import { TrackerCards } from "./components/TrackerCards";
import { DeleteDialog } from "./components/DeleteDialog";
import { downloadRow, downloadWorkbook, parseSpreadsheet } from "./lib/excel";
import { sortRows } from "./lib/sort";
import {
  loadOrderMode,
  loadRows,
  saveOrderMode,
  saveRows,
} from "./lib/storage";
import { createRow, type OrderMode, type TrackerRow } from "./lib/types";

export default function App() {
  const [rows, setRows] = useState<TrackerRow[]>(() => loadRows());
  const [orderMode, setOrderMode] = useState<OrderMode>(() => loadOrderMode());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const newRowId = useRef<string | null>(null);

  useEffect(() => {
    saveRows(rows);
  }, [rows]);

  useEffect(() => {
    saveOrderMode(orderMode);
  }, [orderMode]);

  useEffect(() => {
    if (!newRowId.current) return;
    const input = document.querySelector<HTMLInputElement>(
      `[data-row-id="${newRowId.current}"] input[aria-label="Project/Deliverables"]`,
    );
    input?.focus();
    newRowId.current = null;
  }, [rows]);

  const visible = useMemo(
    () => (orderMode === "auto" ? sortRows(rows) : rows),
    [rows, orderMode],
  );
  const pendingDelete = rows.find((row) => row.id === pendingDeleteId) ?? null;

  function updateRow(id: string, patch: Partial<TrackerRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function rowLabel(row: TrackerRow) {
    return row.project.trim() || "Untitled deliverable";
  }

  function applyOrder(next: TrackerRow[], movedId: string, toIndex: number) {
    setRows(next);
    setOrderMode("manual");
    const moved = next[toIndex];
    setMessage(
      `Moved “${moved ? rowLabel(moved) : movedId}” to position ${toIndex + 1} of ${next.length}. Custom order is on.`,
    );
    setError("");
  }

  function moveRow(id: string, direction: -1 | 1) {
    const list = visible;
    const from = list.findIndex((row) => row.id === id);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    applyOrder(next, id, to);
  }

  function reorderRow(draggedId: string, targetId: string) {
    const list = visible;
    const from = list.findIndex((row) => row.id === draggedId);
    const to = list.findIndex((row) => row.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    applyOrder(next, draggedId, to);
  }

  function resortByPriority() {
    setRows(sortRows(rows));
    setOrderMode("auto");
    setMessage("Rows sorted by priority, then date created.");
    setError("");
  }

  function addRow() {
    const row = createRow();
    newRowId.current = row.id;
    setRows((current) => [row, ...current]);
    setMessage("Row added. Date created was set automatically.");
    setError("");
  }

  async function importFile(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const imported = parseSpreadsheet(buffer);
      if (imported.length === 0) {
        setError("No rows were found in that spreadsheet.");
        setMessage("");
        return;
      }
      setRows((current) => [...current, ...imported]);
      setMessage(`Imported ${imported.length} ${imported.length === 1 ? "row" : "rows"} from ${file.name}.`);
      setError("");
    } catch {
      setError("That file could not be read. Try an .xlsx, .xls, or .csv export.");
      setMessage("");
    }
  }

  function exportAll() {
    downloadWorkbook(visible);
    setMessage("Workbook downloaded.");
  }

  function exportRow(row: TrackerRow) {
    downloadRow(row);
    setMessage(`Exported “${rowLabel(row)}” to Excel.`);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    setRows((current) => current.filter((row) => row.id !== pendingDelete.id));
    setMessage(`Deleted “${rowLabel(pendingDelete)}”.`);
    setPendingDeleteId(null);
  }

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <Header />
      <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl text-secondary">Deliverables</h1>
            <p className="mt-1 max-w-2xl text-sm">
              {orderMode === "auto"
                ? "Sorted by priority, then date created (newest first). Drag the grip handle, or focus it and press the up or down arrow key, to set your own order."
                : "Custom order. Drag the grip handle, or focus it and press the up or down arrow key, to move a row."}{" "}
              Entries stay on this device only.
            </p>
          </div>
          <Toolbar
            onAdd={addRow}
            onImport={importFile}
            onExport={exportAll}
            canExport={rows.length > 0}
            orderMode={orderMode}
            onResort={resortByPriority}
          />
        </div>

        <div className="sr-only" aria-live="polite">
          {message}
          {error}
        </div>
        {error ? (
          <div role="alert" className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        ) : null}
        {message && !error ? (
          <p className="mb-4 text-sm" aria-hidden="true">
            {message}
          </p>
        ) : null}

        <TrackerTable
          rows={visible}
          orderMode={orderMode}
          onChange={updateRow}
          onExportRow={exportRow}
          onRequestDelete={setPendingDeleteId}
          onMove={moveRow}
          onReorder={reorderRow}
        />
        <TrackerCards
          rows={visible}
          onChange={updateRow}
          onExportRow={exportRow}
          onRequestDelete={setPendingDeleteId}
          onMove={moveRow}
        />
      </main>

      {pendingDelete ? (
        <DeleteDialog
          projectName={pendingDelete.project}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
