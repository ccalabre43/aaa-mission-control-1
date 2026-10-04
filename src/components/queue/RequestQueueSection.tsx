/**
 * Reviewer-style Request Queue list (mock: request-queue-reviewer-interface.png).
 *
 * Keeps Workfront connection health, payload summary, and local Ready-to-send flow. Reviewer
 * Status/Priority are local and editable; they are not posted to Workfront yet.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadBriefs, loadIdentity, upsertBrief } from "../../lib/intake/storage";
import {
  REVIEWER_PRIORITIES,
  REVIEWER_STATUSES,
  type IntakeBrief,
  type ReviewerPriority,
  type ReviewerStatus,
} from "../../lib/intake/types";
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
  searchRows,
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
  const [search, setSearch] = useState("");
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
    () =>
      sortQueueRows(searchRows(filterRows(allRows, filter), search), sort),
    [allRows, filter, search, sort],
  );

  const activeFilter = QUEUE_FILTERS.find((item) => item.key === filter) ?? QUEUE_FILTERS[0];
  const openBrief = briefs.find((brief) => brief.id === openBriefId) ?? null;
  const openRow = allRows.find((row) => row.briefId === openBriefId) ?? null;
  const draftCount = allRows.filter((row) => row.isDraft).length;

  function toggleSort(column: QueueColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "desc" },
    );
  }

  function patchBrief(briefId: string, patch: (brief: IntakeBrief) => IntakeBrief) {
    const current = briefs.find((brief) => brief.id === briefId);
    if (!current) return;
    const next = patch(current);
    const saved = upsertBrief(next);
    if (!saved.ok) {
      setError(saved.reason ?? "That request could not be saved to this browser.");
      return;
    }
    setBriefs((list) => list.map((item) => (item.id === next.id ? next : item)));
    setError("");
  }

  function markReviewed(briefId: string) {
    patchBrief(briefId, (brief) => {
      if (brief.reviewer.firstReviewedAt) return brief;
      return {
        ...brief,
        updatedAt: new Date().toISOString(),
        reviewer: {
          ...brief.reviewer,
          firstReviewedAt: new Date().toISOString(),
        },
      };
    });
  }

  function openSummary(briefId: string) {
    markReviewed(briefId);
    setOpenBriefId(briefId);
  }

  function updateReviewerStatus(briefId: string, nextStatus: ReviewerStatus) {
    patchBrief(briefId, (brief) => ({
      ...brief,
      updatedAt: new Date().toISOString(),
      reviewer: {
        ...brief.reviewer,
        status: nextStatus,
        firstReviewedAt: brief.reviewer.firstReviewedAt ?? new Date().toISOString(),
      },
    }));
  }

  function updatePriority(briefId: string, priority: ReviewerPriority) {
    patchBrief(briefId, (brief) => ({
      ...brief,
      updatedAt: new Date().toISOString(),
      reviewer: {
        ...brief.reviewer,
        priority,
        firstReviewedAt: brief.reviewer.firstReviewedAt ?? new Date().toISOString(),
      },
    }));
  }

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
    setStatus(
      `"${result.issueName}" is marked Ready to send and saved in this browser. It has not been sent to Workfront.`,
    );
  }

  return (
    <section className="aaa-queue aaa-queue-reviewer" aria-labelledby="queue-requests-heading">
      <div className="aaa-queue-hero">
        <div className="aaa-queue-hero-main">
          <div className="aaa-queue-hero-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z"
                stroke="currentColor"
                strokeWidth="1.75"
              />
            </svg>
          </div>
          <div>
            <h2 id="queue-requests-heading" className="aaa-queue-heading">
              Request queue
            </h2>
            <p className="aaa-queue-sub">What would you like to review today?</p>
          </div>
        </div>
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

      <label className="aaa-queue-search">
        <span className="sr-only">Search by title, requestor, or channel</span>
        <span className="aaa-queue-search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, requestor, or channel..."
          autoComplete="off"
        />
      </label>

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
          {search.trim()
            ? "No requests match that search in this browser."
            : filter === "drafts"
              ? "No drafts in this browser."
              : "No ready-to-send requests in this browser yet."}{" "}
          <Link to="/request">Start a request</Link>
        </p>
      ) : (
        <>
          <div className="aaa-queue-table-wrap">
            <table className="aaa-queue-table aaa-queue-table-reviewer">
              <caption className="sr-only">
                Sorted by{" "}
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
                          <span aria-hidden="true" className="aaa-queue-sort-caret">
                            {sort.column === column.key
                              ? sort.direction === "asc"
                                ? " ▲"
                                : " ▼"
                              : ""}
                          </span>
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
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
                        <button
                          type="button"
                          className="aaa-queue-subject"
                          onClick={() => openSummary(row.briefId)}
                        >
                          {row.name}
                        </button>
                        {row.isNew ? (
                          <span className="aaa-queue-new">NEW</span>
                        ) : null}
                      </th>
                      <td>
                        <ul className="aaa-queue-pills" aria-label="Channels">
                          {row.channels.length === 0 ? (
                            <li className="aaa-queue-pill is-empty">—</li>
                          ) : (
                            row.channels.map((channel) => (
                              <li key={channel} className="aaa-queue-pill">
                                {channel}
                              </li>
                            ))
                          )}
                        </ul>
                      </td>
                      <td>
                        <label className="aaa-queue-status-control">
                          <span
                            className={`aaa-queue-status-dot status-${row.reviewerStatus}`}
                            aria-hidden="true"
                          />
                          <span className="sr-only">Status</span>
                          <select
                            value={row.reviewerStatus}
                            onChange={(event) =>
                              updateReviewerStatus(
                                row.briefId,
                                event.target.value as ReviewerStatus,
                              )
                            }
                          >
                            {REVIEWER_STATUSES.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </td>
                      <td>
                        <label className="aaa-queue-priority-control">
                          <span className="sr-only">Priority</span>
                          <select
                            className="aaa-queue-priority-select"
                            value={row.priority}
                            onChange={(event) =>
                              updatePriority(
                                row.briefId,
                                event.target.value as ReviewerPriority,
                              )
                            }
                          >
                            {REVIEWER_PRIORITIES.map((priority) => (
                              <option key={priority} value={priority}>
                                {priority}
                              </option>
                            ))}
                          </select>
                        </label>
                      </td>
                      <td>{formatQueueDate(row.entryDate)}</td>
                      <td>
                        <span className="aaa-queue-requestor">
                          <span className="aaa-queue-avatar" aria-hidden="true">
                            {row.requesterInitials}
                          </span>
                          {row.requesterName}
                        </span>
                      </td>
                      <td className="aaa-queue-actions">
                        <button
                          type="button"
                          className="aaa-btn-text"
                          onClick={() => openSummary(row.briefId)}
                        >
                          Summary
                        </button>
                        {row.isDraft && brief ? (
                          <button
                            type="button"
                            className="aaa-btn-text"
                            onClick={() => submitDraft(brief)}
                          >
                            Mark ready to send
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
                  <p className="aaa-queue-card-name">
                    {row.name}
                    {row.isNew ? <span className="aaa-queue-new">NEW</span> : null}
                  </p>
                  <dl className="aaa-queue-card-list">
                    <div>
                      <dt>Channels</dt>
                      <dd>{row.channels.join(", ") || "—"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <label className="aaa-queue-status-control">
                          <span
                            className={`aaa-queue-status-dot status-${row.reviewerStatus}`}
                            aria-hidden="true"
                          />
                          <select
                            value={row.reviewerStatus}
                            onChange={(event) =>
                              updateReviewerStatus(
                                row.briefId,
                                event.target.value as ReviewerStatus,
                              )
                            }
                          >
                            {REVIEWER_STATUSES.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>
                        <select
                          className="aaa-queue-priority-select"
                          value={row.priority}
                          onChange={(event) =>
                            updatePriority(
                              row.briefId,
                              event.target.value as ReviewerPriority,
                            )
                          }
                        >
                          {REVIEWER_PRIORITIES.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                      </dd>
                    </div>
                    <div>
                      <dt>Entry Date</dt>
                      <dd>{formatQueueDate(row.entryDate)}</dd>
                    </div>
                    <div>
                      <dt>Requestor</dt>
                      <dd>{row.requesterName}</dd>
                    </div>
                    <div>
                      <dt>Workfront path</dt>
                      <dd>
                        {row.path}
                        {row.routeSource === "derived" ? " (derived)" : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Sent to Workfront</dt>
                      <dd>No</dd>
                    </div>
                  </dl>
                  <div className="aaa-queue-actions">
                    <button
                      type="button"
                      className="aaa-btn-text"
                      onClick={() => openSummary(row.briefId)}
                    >
                      Summary
                    </button>
                    {row.isDraft && brief ? (
                      <button
                        type="button"
                        className="aaa-btn-text"
                        onClick={() => submitDraft(brief)}
                      >
                        Mark ready to send
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
        Reviewer Status and Priority are saved in this browser only. They are not sent to Workfront
        yet. Every row still shows Sent to Workfront: No until dual-write is enabled.
      </p>

      {openBrief && openRow ? (
        <RequestSummaryPanel
          brief={openBrief}
          row={openRow}
          queueConfig={queueConfig}
          onClose={() => setOpenBriefId(null)}
          onUpdateReviewer={(next) => {
            patchBrief(openBrief.id, (brief) => ({
              ...brief,
              updatedAt: new Date().toISOString(),
              reviewer: {
                ...brief.reviewer,
                ...next,
                firstReviewedAt:
                  brief.reviewer.firstReviewedAt ?? new Date().toISOString(),
              },
            }));
          }}
        />
      ) : null}
    </section>
  );
}
