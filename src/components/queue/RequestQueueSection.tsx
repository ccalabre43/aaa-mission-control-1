/**
 * The requests half of the Request Queue: Workfront's Submitted Requests list, built from briefs
 * saved in this browser.
 *
 * Connection state is a first-class element rather than a footnote: the header reads proxy health
 * ("Workfront: connected (mission-control-v1)" or "not connected"), every row still says
 * "Sent to Workfront: No" until dual-write exists, and the payload view proves the request is
 * complete. No fabricated reference number, no fabricated Entered By, no green "Sent" state.
 *
 * Desktop gets the table; narrow widths get cards. Same rows, same order, same actions - a table with
 * six columns cannot be read at 390px, and horizontal scrolling a data table is a 1.4.10 reflow
 * failure rather than a compromise.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadBriefs, loadIdentity, upsertBrief } from "../../lib/intake/storage";
import type { IntakeBrief } from "../../lib/intake/types";
import { loadQueueConfig } from "../../lib/workfront/queueConfig";
import {
  fetchWorkfrontHealth,
  type WorkfrontProxyHealth,
} from "../../lib/workfront/proxyHealth";
import { submitToWorkfront } from "../../lib/workfront/submitToWorkfront";
import {
  DEFAULT_SORT,
  QUEUE_COLUMNS,
  QUEUE_FILTERS,
  ariaSortFor,
  filterRows,
  formatQueueDate,
  sortQueueRows,
  toQueueRow,
  type QueueColumn,
  type QueueFilter,
  type SortState,
} from "../../lib/workfront/queueList";
import { RequestSummaryPanel } from "./RequestSummaryPanel";

export function RequestQueueSection() {
  const [load] = useState(() => loadBriefs());
  const [briefs, setBriefs] = useState<IntakeBrief[]>(load.briefs);
  const [queueConfig] = useState(() => loadQueueConfig().config);
  const viewer = useMemo(() => loadIdentity(), []);
  const [health, setHealth] = useState<WorkfrontProxyHealth | null>(null);

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [openBriefId, setOpenBriefId] = useState<string | null>(null);
  const [status, setStatus] = useState(
    load.status === "recovered"
      ? "Recovered your saved requests from the local backup copy."
      : "",
  );
  const [error, setError] = useState(
    load.status === "unreadable"
      ? "Saved requests could not be read from this browser, so none are listed. Your stored data was left untouched."
      : "",
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkfrontHealth(controller.signal).then(setHealth);
    return () => controller.abort();
  }, []);

  const allRows = useMemo(
    () => briefs.map((brief) => toQueueRow(brief, queueConfig, viewer)),
    [briefs, queueConfig, viewer],
  );

  const rows = useMemo(
    () => sortQueueRows(filterRows(allRows, filter), sort),
    [allRows, filter, sort],
  );

  const activeFilter = QUEUE_FILTERS.find((item) => item.key === filter) ?? QUEUE_FILTERS[0];
  const openBrief = briefs.find((brief) => brief.id === openBriefId) ?? null;
  const openRow = allRows.find((row) => row.briefId === openBriefId) ?? null;
  const draftCount = allRows.filter((row) => row.isDraft).length;

  /** Clicking a sortable header toggles direction, or takes over the sort at descending. */
  function toggleSort(column: QueueColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "desc" },
    );
  }

  /**
   * Submits a draft from the queue, through the same validator the Review step uses.
   *
   * This adds a second way in rather than moving the first. Someone who left a brief unfinished
   * comes back to the queue, not to the flow, and making them re-walk seven steps to press a button
   * they can already see is the kind of friction that gets a tool abandoned.
   */
  async function submitDraft(brief: IntakeBrief) {
    const result = await submitToWorkfront(brief, queueConfig);
    if (!result.ok) {
      setError(
        `"${brief.a3.A3IntakeProjectSummary || "This request"}" is not complete yet. Still needed: ${result.missingFields.join(", ")}.`,
      );
      setStatus("");
      return;
    }
    const submittedAt = new Date().toISOString();
    const next: IntakeBrief = {
      ...brief,
      status: "submitted",
      submittedAt,
      updatedAt: submittedAt,
      workfront: { mode: "local", issueName: result.issueName, submittedAt },
    };
    const saved = upsertBrief(next);
    if (!saved.ok) {
      setError(saved.reason ?? "That request could not be saved to this browser.");
      return;
    }
    setBriefs((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
    setError("");
    // Says what actually happened, and no more. Nothing was transmitted.
    setStatus(
      `"${result.issueName}" is marked Ready to send and saved in this browser. It has not been sent to Workfront.`,
    );
  }

  return (
    <section className="aaa-queue" aria-labelledby="queue-requests-heading">
      <div className="aaa-queue-head">
        <div>
          <h2 id="queue-requests-heading" className="aaa-queue-heading">
            Requests
          </h2>
          <p className="aaa-queue-sub">
            Requests built in the guided flow, shaped the way Workfront's Submitted Requests list
            shows them. Everything here is saved in this browser only.
          </p>
        </div>

        {/*
          Connection state comes from the Workfront proxy health check. The word carries the state
          (1.4.1); the dot is decorative. A failed or unreachable proxy stays "not connected" rather
          than implying organization-wide coverage.
        */}
        <p
          className={
            health?.connected
              ? "aaa-queue-connection is-connected"
              : "aaa-queue-connection"
          }
          title={
            health?.connected
              ? `Proxy health OK via ${health.endpoint}`
              : health?.error
                ? `${health.error} (checked ${health.endpoint})`
                : "Checking the Workfront proxy…"
          }
        >
          <span className="aaa-queue-connection-dot" aria-hidden="true" />
          {health?.connected && health.project
            ? `Workfront: connected (${health.project.name})`
            : health === null
              ? "Workfront: checking…"
              : "Workfront: not connected"}
        </p>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {status}
        {error}
      </div>
      {error ? (
        <div role="alert" className="aaa-flow-alert">
          {error}
        </div>
      ) : null}
      {status && !error ? <p className="aaa-page-status">{status}</p> : null}

      {/*
        Buttons in a group rather than role="tablist": these filter a list that stays in place, they
        do not switch panels, and announcing them as tabs would promise a panel change that never
        comes. `aria-pressed` carries the state instead.
      */}
      <div className="aaa-queue-filters" role="group" aria-label="Filter requests">
        {QUEUE_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filter === item.key ? "aaa-queue-filter is-active" : "aaa-queue-filter"}
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            {item.key === "drafts" && draftCount > 0 ? ` (${draftCount})` : ""}
          </button>
        ))}
      </div>
      <p className="aaa-queue-filter-note">{activeFilter.description}</p>

      {rows.length === 0 ? (
        <p className="aaa-queue-empty">
          {filter === "drafts"
            ? "No drafts in this browser."
            : "No submitted requests in this browser yet."}{" "}
          <Link to="/request" className="aaa-link-quiet">
            Start Request
          </Link>
        </p>
      ) : (
        <>
          <div className="aaa-queue-table-wrap">
            <table className="aaa-queue-table">
              <caption className="sr-only">
                Requests saved in this browser, sorted by{" "}
                {QUEUE_COLUMNS.find((column) => column.key === sort.column)?.label}{" "}
                {sort.direction === "asc" ? "ascending" : "descending"}
              </caption>
              <thead>
                <tr>
                  {QUEUE_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        column.sortable ? ariaSortFor(column.key, sort) : undefined
                      }
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          className="aaa-queue-sort"
                          onClick={() => toggleSort(column.key)}
                        >
                          {column.label}
                          <span className="sr-only">
                            , sort by {column.label}
                            {sort.column === column.key
                              ? sort.direction === "asc"
                                ? ", currently ascending"
                                : ", currently descending"
                              : ""}
                          </span>
                          <span aria-hidden="true" className="aaa-queue-sort-caret">
                            {sort.column === column.key
                              ? sort.direction === "asc"
                                ? "\u25B2"
                                : "\u25BC"
                              : ""}
                          </span>
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                  <th scope="col">Sent to Workfront</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const brief = briefs.find((item) => item.id === row.briefId);
                  return (
                    <tr key={row.briefId}>
                      <th scope="row" className="aaa-queue-name">
                        {row.name}
                      </th>
                      <td>
                        {/* Empty until Workfront converts the issue. */}
                        <span className="sr-only">Not converted</span>
                      </td>
                      <td>
                        {row.path}
                        {row.routeSource === "derived" ? (
                          <span className="aaa-queue-derived"> (derived)</span>
                        ) : null}
                      </td>
                      <td>{row.status}</td>
                      <td>{formatQueueDate(row.entryDate)}</td>
                      <td>{formatQueueDate(row.lastUpdateDate)}</td>
                      {/* Never conveyed by color alone (1.4.1): the word is the state. */}
                      <td className="aaa-queue-sent">No</td>
                      <td className="aaa-queue-actions">
                        <button
                          type="button"
                          className="aaa-btn-text"
                          onClick={() => setOpenBriefId(row.briefId)}
                        >
                          Summary
                          <span className="sr-only"> for {row.name}</span>
                        </button>
                        {row.isDraft && brief ? (
                          <button
                            type="button"
                            className="aaa-btn-text"
                            onClick={() => submitDraft(brief)}
                          >
                            Submit
                            <span className="sr-only"> {row.name}</span>
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="aaa-queue-cards" role="list">
            {rows.map((row) => {
              const brief = briefs.find((item) => item.id === row.briefId);
              return (
                <li key={row.briefId} className="aaa-queue-card">
                  <p className="aaa-queue-card-name">{row.name}</p>
                  <dl className="aaa-queue-card-list">
                    <div>
                      <dt>Path</dt>
                      <dd>
                        {row.path}
                        {row.routeSource === "derived" ? " (derived)" : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{row.status}</dd>
                    </div>
                    <div>
                      <dt>Sent to Workfront</dt>
                      <dd>No</dd>
                    </div>
                    <div>
                      <dt>Entry Date</dt>
                      <dd>{formatQueueDate(row.entryDate) || "Not submitted"}</dd>
                    </div>
                    <div>
                      <dt>Last Update Date</dt>
                      <dd>{formatQueueDate(row.lastUpdateDate)}</dd>
                    </div>
                  </dl>
                  <div className="aaa-queue-actions">
                    <button
                      type="button"
                      className="aaa-btn-text"
                      onClick={() => setOpenBriefId(row.briefId)}
                    >
                      Summary
                      <span className="sr-only"> for {row.name}</span>
                    </button>
                    {row.isDraft && brief ? (
                      <button
                        type="button"
                        className="aaa-btn-text"
                        onClick={() => submitDraft(brief)}
                      >
                        Submit
                        <span className="sr-only"> {row.name}</span>
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="aaa-queue-footnote">
        Ref # and Entered By are assigned by Workfront when an issue is created, so neither is shown
        here - a locally invented value for either would look like a Workfront identifier without
        being one.{" "}
        <Link to="/settings/queue" className="aaa-link-quiet">
          Manage the queue
        </Link>
      </p>

      {openBrief && openRow ? (
        <RequestSummaryPanel
          brief={openBrief}
          row={openRow}
          queueConfig={queueConfig}
          onClose={() => setOpenBriefId(null)}
        />
      ) : null}
    </section>
  );
}
