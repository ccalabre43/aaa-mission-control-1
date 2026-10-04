/**
 * Request Queue page: reviewer Request queue tab + Executive dashboard tab.
 *
 * Requests stay on `aaa-intake-briefs` with a Workfront payload path. The Project tracker stays on
 * `aaa-project-tracker` (key and Excel headers unchanged) and lives under Executive dashboard so
 * local capacity notes are not deleted.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { RequestQueueSection } from "../components/queue/RequestQueueSection";
import { ExecutiveDashboardSection } from "../components/queue/ExecutiveDashboardSection";
import { SavedVersionsSection } from "../components/queue/SavedVersionsSection";
import { countSampleBriefs } from "../lib/dev/sampleQueue";
import { loadBriefs } from "../lib/intake/storage";
import { Toolbar } from "../components/Toolbar";
import { TrackerTable } from "../components/TrackerTable";
import { TrackerCards } from "../components/TrackerCards";
import { DeleteDialog } from "../components/DeleteDialog";
import { downloadRow, downloadWorkbook, parseSpreadsheet } from "../lib/excel";
import { sortRows } from "../lib/sort";
import {
  clearTrackerData,
  loadOrderMode,
  loadRows,
  saveOrderMode,
  saveRows,
} from "../lib/storage";
import { createRow, type OrderMode, type TrackerRow } from "../lib/types";

type PageTab = "queue" | "executive";

const initialLoad = loadRows();

export default function DeliverablesView() {
  const [pageTab, setPageTab] = useState<PageTab>("queue");
  const [rows, setRows] = useState<TrackerRow[]>(initialLoad.rows);
  const [orderMode, setOrderMode] = useState<OrderMode>(() => loadOrderMode());
  const [message, setMessage] = useState(
    initialLoad.status === "recovered"
      ? "Recovered your rows from the local backup copy."
      : "",
  );
  const [error, setError] = useState(
    initialLoad.status === "unreadable"
      ? "Saved rows could not be read from this browser, so nothing was loaded. Your stored data was left untouched - adding a row will replace it."
      : "",
  );
  /** Bumped after a snapshot import or a sample load, to force every reader back to storage. */
  const [dataEpoch, setDataEpoch] = useState(0);
  const [sampleCount, setSampleCount] = useState(() =>
    countSampleBriefs(loadBriefs().briefs),
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  const newRowId = useRef<string | null>(null);
  const deletionInFlight = useRef(false);

  // Rows persist on every change. An empty list is only ever written when the
  // user deleted the last row, so a failed read can never erase saved work.
  useEffect(() => {
    if (rows.length === 0 && !deletionInFlight.current) return;
    deletionInFlight.current = false;
    const result = saveRows(rows);
    if (!result.ok && result.reason) setError(result.reason);
  }, [rows]);

  // Insurance for a tab closed mid-edit.
  useEffect(() => {
    function flush() {
      if (rows.length > 0) saveRows(rows);
    }
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
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
      `Moved "${moved ? rowLabel(moved) : movedId}" to position ${toIndex + 1} of ${next.length}. Custom order is on.`,
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
      const imported = await parseSpreadsheet(buffer);
      if (imported.length === 0) {
        setError("No rows were found in that spreadsheet.");
        setMessage("");
        return;
      }
      setRows((current) => [...current, ...imported]);
      setMessage(
        `Imported ${imported.length} ${imported.length === 1 ? "row" : "rows"} from ${file.name}.`,
      );
      setError("");
    } catch {
      setError("That file could not be read. Try an .xlsx, .xls, or .csv export.");
      setMessage("");
    }
  }

  /*
   * The spreadsheet library is fetched on first use, so these two are async now and the success
   * message waits for the download rather than being announced before it happens. The catch is not
   * defensive padding: a lazily loaded chunk can genuinely fail on a dropped connection, and
   * without it the button would look inert while the real error sat in the console.
   */
  async function exportAll() {
    try {
      await downloadWorkbook(visible);
      setMessage("Workbook downloaded.");
      setError("");
    } catch {
      setError("The export could not be prepared. Check your connection and try again.");
      setMessage("");
    }
  }

  function saveRow(row: TrackerRow) {
    const result = saveRows(rows);
    if (result.ok) {
      setMessage(`Saved "${rowLabel(row)}" to this device.`);
      setError("");
    } else if (result.reason) {
      setError(result.reason);
    }
  }

  async function exportRow(row: TrackerRow) {
    try {
      await downloadRow(row);
      setMessage(`Exported "${rowLabel(row)}" to Excel.`);
      setError("");
    } catch {
      setError("The export could not be prepared. Check your connection and try again.");
      setMessage("");
    }
  }

  /**
   * Removes the stored keys rather than saving an empty list. Writing `[]` would leave the backup
   * copy sitting in localStorage, so a user who asked to clear their data would still have it on
   * the device. The save effect ignores an empty list unless a deletion is in flight, which is why
   * nothing is written straight back afterwards.
   */
  function clearAllRows() {
    clearTrackerData();
    setRows([]);
    setOrderMode("auto");
    setConfirmingClearAll(false);
    setMessage("All queue rows were deleted from this browser.");
    setError("");
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deletionInFlight.current = true;
    setRows((current) => current.filter((row) => row.id !== pendingDelete.id));
    setMessage(`Deleted "${rowLabel(pendingDelete)}".`);
    setPendingDeleteId(null);
  }

  function onSnapshotChanged() {
    const reloaded = loadRows();
    setRows(reloaded.rows);
    setOrderMode(loadOrderMode());
    setSampleCount(countSampleBriefs(loadBriefs().briefs));
    setDataEpoch((epoch) => epoch + 1);
  }

  return (
    <>
      <main id="main" className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6">
        <h1 className="font-display text-3xl text-secondary">
          Mission Control / New creative requests
        </h1>

        <div
          className="aaa-page-tabs"
          role="tablist"
          aria-label="Request Queue sections"
        >
          <button
            type="button"
            role="tab"
            id="tab-request-queue"
            aria-selected={pageTab === "queue"}
            aria-controls="panel-request-queue"
            className={pageTab === "queue" ? "aaa-page-tab is-active" : "aaa-page-tab"}
            onClick={() => setPageTab("queue")}
          >
            Request queue
          </button>
          <button
            type="button"
            role="tab"
            id="tab-executive"
            aria-selected={pageTab === "executive"}
            aria-controls="panel-executive"
            className={
              pageTab === "executive" ? "aaa-page-tab is-active" : "aaa-page-tab"
            }
            onClick={() => setPageTab("executive")}
          >
            Executive dashboard
          </button>
        </div>

        {pageTab === "queue" ? (
          <div
            id="panel-request-queue"
            role="tabpanel"
            aria-labelledby="tab-request-queue"
          >
            <RequestQueueSection key={`requests-${dataEpoch}`} />
          </div>
        ) : (
          <div id="panel-executive" role="tabpanel" aria-labelledby="tab-executive">
            <ExecutiveDashboardSection
              key={`exec-${dataEpoch}`}
              trackerRows={rows}
              dataEpoch={dataEpoch}
            />

            <SavedVersionsSection
              sampleCount={sampleCount}
              onDataChanged={onSnapshotChanged}
            />

            <section
              className="aaa-queue aaa-queue-tracker"
              aria-labelledby="queue-tracker-heading"
            >
              <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 id="queue-tracker-heading" className="aaa-queue-heading">
                    Project tracker
                  </h2>
                  <p className="aaa-queue-sub">
                    Local capacity notes you type or import from Excel — not sent to Workfront.{" "}
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
                onSaveRow={saveRow}
                onExportRow={exportRow}
                onRequestDelete={setPendingDeleteId}
                onMove={moveRow}
                onReorder={reorderRow}
              />
              <TrackerCards
                rows={visible}
                onChange={updateRow}
                onSaveRow={saveRow}
                onExportRow={exportRow}
                onRequestDelete={setPendingDeleteId}
                onMove={moveRow}
              />

              {rows.length > 0 ? (
                <div className="mt-10 border-t border-[var(--aaa-border)] pt-4 text-sm">
                  {confirmingClearAll ? (
                    <span className="aaa-clear-confirm">
                      Delete all {rows.length}{" "}
                      {rows.length === 1 ? "row" : "rows"} from this browser? There is no
                      server copy, so export first if you want to keep them.
                      <button
                        type="button"
                        className="aaa-btn-text-danger"
                        onClick={clearAllRows}
                      >
                        Yes, delete all rows
                      </button>
                      <button
                        type="button"
                        className="aaa-btn-text"
                        onClick={() => setConfirmingClearAll(false)}
                      >
                        Keep them
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="aaa-link-quiet"
                      onClick={() => setConfirmingClearAll(true)}
                    >
                      Clear all project tracker rows from this device
                    </button>
                  )}
                </div>
              ) : null}
            </section>
          </div>
        )}
      </main>

      {pendingDelete ? (
        <DeleteDialog
          projectName={pendingDelete.project}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </>
  );
}
