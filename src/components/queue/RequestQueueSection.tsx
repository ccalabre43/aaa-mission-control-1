/**
 * Reviewer-style Request Queue list (mock: request-queue-reviewer-interface.png).
 *
 * Local Ready-to-send rows stay in this browser. Refresh upserts summary Tasks from
 * mission-control-v1 into local briefs (Workfront wins on match); coverage names that corpus
 * (guardrail 7). Local-only briefs without a matching Task are kept.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deleteBrief,
  loadBriefs,
  loadIdentity,
  saveBriefs,
  upsertBrief,
} from "../../lib/intake/storage";
import {
  REVIEWER_PRIORITIES,
  REVIEWER_STATUSES,
  type IntakeBrief,
  type ReviewerPriority,
  type ReviewerStatus,
} from "../../lib/intake/types";
import { loadQueueConfig } from "../../lib/workfront/queueConfig";
import {
  fetchWorkfrontIssues,
  updateWorkfrontTaskPriority,
  type WorkfrontRemoteIssue,
} from "../../lib/workfront/proxyClient";
import {
  fetchWorkfrontHealth,
  type WorkfrontProxyHealth,
} from "../../lib/workfront/proxyHealth";
import { mergeRemoteTasksIntoBriefs } from "../../lib/workfront/mergeRemoteTasks";
import { submitToWorkfront } from "../../lib/workfront/submitToWorkfront";
import {
  DEFAULT_SORT,
  QUEUE_COLUMNS,
  QUEUE_FILTERS,
  ariaSortFor,
  filterRows,
  formatQueueDate,
  moveSelectedInVisibleOrder,
  searchRows,
  sortQueueRows,
  toQueueRow,
  truncateWords,
  type QueueColumn,
  type QueueFilter,
  type SortState,
} from "../../lib/workfront/queueList";
import { WorkfrontRefreshDialog } from "./WorkfrontRefreshDialog";

interface RefreshDialogState {
  issues: WorkfrontRemoteIssue[];
  added: number;
  updated: number;
  linked: number;
  coverage: string;
}

export function RequestQueueSection() {
  const navigate = useNavigate();
  const [load] = useState(() => loadBriefs());
  const [briefs, setBriefs] = useState<IntakeBrief[]>(load.briefs);
  const [queueConfig] = useState(() => loadQueueConfig().config);
  const viewer = useMemo(() => loadIdentity(), []);
  const [health, setHealth] = useState<WorkfrontProxyHealth | null>(null);
  const [remoteCoverage, setRemoteCoverage] = useState("");
  const [remoteError, setRemoteError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshDialog, setRefreshDialog] = useState<RefreshDialogState | null>(
    null,
  );

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  /** When true, display follows `briefs` array order (after Move up/down). */
  const [manualOrder, setManualOrder] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
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

  const refreshFromWorkfront = useCallback(async () => {
    setRefreshing(true);
    setRemoteError("");
    try {
      const result = await fetchWorkfrontIssues();
      const remote = result.issues.filter((issue) => issue.ID);
      setRemoteCoverage(result.coverage);
      if (!result.ok) {
        setRemoteError(
          result.error ??
            "Workfront Task search failed. Local Request Queue rows were not changed.",
        );
        return;
      }

      // Read storage at click time so a stale React closure cannot drop concurrent edits.
      const { briefs: current } = loadBriefs();
      const merged = mergeRemoteTasksIntoBriefs(current, remote);
      const saved = saveBriefs(merged.briefs);
      if (!saved.ok) {
        setError(
          saved.reason ??
            "Workfront Tasks were fetched but could not be saved into this browser's Request Queue.",
        );
        setStatus("");
        return;
      }
      setBriefs(merged.briefs);
      setError("");
      setStatus("");
      setRefreshDialog({
        issues: remote,
        added: merged.added,
        updated: merged.updated,
        linked: merged.linked,
        coverage: result.coverage,
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const refreshLiveAnnouncement = useMemo(() => {
    if (!refreshDialog) return "";
    const { added, updated, linked, coverage } = refreshDialog;
    const summary = `Workfront refresh (mission-control-v1): added ${added}, updated ${updated} in this browser's Request Queue (${linked} Task${linked === 1 ? "" : "s"} linked). Local-only rows without a matching Task were kept.`;
    return coverage.trim() ? `${summary} ${coverage.trim()}` : summary;
  }, [refreshDialog]);

  const allRows = useMemo(
    () => briefs.map((brief) => toQueueRow(brief, queueConfig, viewer)),
    [briefs, queueConfig, viewer],
  );

  const rows = useMemo(() => {
    const filtered = searchRows(filterRows(allRows, filter), search);
    if (manualOrder) return filtered;
    return sortQueueRows(filtered, sort);
  }, [allRows, filter, search, sort, manualOrder]);

  const visibleIds = useMemo(() => rows.map((row) => row.briefId), [rows]);
  const selectedCount = useMemo(() => {
    let count = 0;
    for (const id of visibleIds) {
      if (selectedIds.has(id)) count += 1;
    }
    return count;
  }, [visibleIds, selectedIds]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = selectedCount > 0 && !allVisibleSelected;

  const activeFilter = QUEUE_FILTERS.find((item) => item.key === filter) ?? QUEUE_FILTERS[0];
  const draftCount = allRows.filter((row) => row.isDraft).length;
  const localReadyCount = allRows.filter((row) => !row.isDraft).length;
  const linkedBriefIds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const brief of briefs) {
      if (brief.workfront?.mode === "workfront" && brief.workfront.issueId) {
        map[brief.workfront.issueId] = brief.id;
      }
    }
    return map;
  }, [briefs]);
  const coverageLine = useMemo(() => {
    const localPart = `${localReadyCount} ready-to-send brief${localReadyCount === 1 ? "" : "s"} in this browser`;
    if (remoteCoverage) {
      return `${remoteCoverage} Refresh upserts those Tasks into this browser's Request Queue (Workfront wins on match). Showing ${localPart}. Not organization-wide.`;
    }
    return `Showing ${localPart}. Use Refresh from Workfront to add or update Tasks from mission-control-v1 into this queue.`;
  }, [localReadyCount, remoteCoverage]);

  function toggleSort(column: QueueColumn) {
    setManualOrder(false);
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "desc" },
    );
  }

  function toggleRowSelected(briefId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(briefId)) next.delete(briefId);
      else next.add(briefId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function moveSelection(direction: -1 | 1) {
    const allIds = briefs.map((brief) => brief.id);
    const nextOrder = moveSelectedInVisibleOrder(
      allIds,
      visibleIds,
      selectedIds,
      direction,
    );
    if (!nextOrder) {
      setStatus(
        direction === -1
          ? "Selection is already at the top of the visible list."
          : "Selection is already at the bottom of the visible list.",
      );
      return;
    }
    const byId = new Map(briefs.map((brief) => [brief.id, brief]));
    const reordered: IntakeBrief[] = [];
    for (const id of nextOrder) {
      const brief = byId.get(id);
      if (brief) reordered.push(brief);
    }
    if (reordered.length !== briefs.length) {
      setError("That reorder could not be applied. Your saved data was left untouched.");
      return;
    }
    const saved = saveBriefs(reordered);
    if (!saved.ok) {
      setError(saved.reason ?? "That reorder could not be saved to this browser.");
      return;
    }
    setBriefs(reordered);
    setManualOrder(true);
    setError("");
    setStatus(
      `Moved ${selectedCount} selected request${selectedCount === 1 ? "" : "s"} in this browser's Request Queue. Order is saved locally.`,
    );
  }

  function removeLocalBrief(briefId: string, subject: string) {
    const brief = briefs.find((item) => item.id === briefId);
    const taskId =
      brief?.workfront?.mode === "workfront" && brief.workfront.issueId
        ? brief.workfront.issueId
        : null;
    const confirmed = window.confirm(
      [
        `Delete "${subject}" from this browser's Request Queue?`,
        "",
        taskId
          ? `This only removes the local copy. Workfront Task ${taskId} is not deleted.`
          : "This only removes the local copy. Nothing is sent to Workfront.",
      ].join("\n"),
    );
    if (!confirmed) return;
    const saved = deleteBrief(briefId);
    if (!saved.ok) {
      setError(saved.reason ?? "That request could not be deleted from this browser.");
      return;
    }
    setBriefs((current) => current.filter((item) => item.id !== briefId));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(briefId);
      return next;
    });
    setError("");
    setStatus(
      taskId
        ? `Removed "${subject}" from this browser. Workfront Task ${taskId} was not deleted.`
        : `Removed "${subject}" from this browser's Request Queue.`,
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

  function openSummary(briefId: string) {
    navigate(`/deliverables/requests/${briefId}`);
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

  async function updatePriority(briefId: string, priority: ReviewerPriority) {
    const current = briefs.find((brief) => brief.id === briefId);
    if (!current) return;

    patchBrief(briefId, (brief) => ({
      ...brief,
      updatedAt: new Date().toISOString(),
      reviewer: {
        ...brief.reviewer,
        priority,
        firstReviewedAt: brief.reviewer.firstReviewedAt ?? new Date().toISOString(),
      },
    }));

    const taskId = current.workfront?.issueId?.trim();
    const wantLive = Boolean(health?.connected && health.liveSubmit && taskId);
    if (!wantLive || !taskId) {
      if (taskId && health?.connected && !health.liveSubmit) {
        setStatus(
          `Priority set to ${priority} in this browser. Live sync is off (WORKFRONT_LIVE_SUBMIT) — Workfront Task ${taskId} was not updated.`,
        );
      } else {
        setStatus(`Priority set to ${priority} in this browser.`);
      }
      return;
    }

    const confirmed = window.confirm(
      [
        `Update Workfront Task ${taskId} priority to ${priority}?`,
        "",
        "This writes the Task priority field (urgency), not Portfolio Optimization project order.",
      ].join("\n"),
    );
    if (!confirmed) {
      setStatus(
        `Priority set to ${priority} in this browser. Live Workfront sync cancelled.`,
      );
      return;
    }

    const result = await updateWorkfrontTaskPriority({
      taskId,
      priority,
      confirmLive: true,
    });
    if (!result.ok) {
      setError(`Priority saved locally but Workfront sync failed: ${result.error}`);
      setStatus(`Priority ${priority} is local-only until sync succeeds.`);
      return;
    }
    setError("");
    setStatus(
      `Priority ${priority} saved locally and on Workfront Task ${taskId} (urgency ${result.priority}).`,
    );
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
        <div className="aaa-queue-connection-wrap">
          <p
            className={
              health?.connected
                ? "aaa-queue-connection is-connected"
                : "aaa-queue-connection"
            }
            title={
              health?.connected
                ? `Proxy health OK via ${health.endpoint}${
                    health.liveSubmit ? "; live submit on" : "; live submit off"
                  }`
                : health?.error
                  ? `${health.error} (checked ${health.endpoint})`
                  : "Checking the Workfront proxy…"
            }
          >
            <span className="aaa-queue-connection-dot" aria-hidden="true" />
            {health?.connected && health.project
              ? `Workfront: connected (${health.project.name}${
                  health.liveSubmit ? "; live submit on" : ""
                })`
              : health === null
                ? "Workfront: checking…"
                : "Workfront: not connected"}
          </p>
          <button
            type="button"
            className="aaa-btn-text"
            onClick={() => refreshFromWorkfront()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh from Workfront"}
          </button>
        </div>
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
        {refreshLiveAnnouncement || status}
        {error}
      </div>
      {error ? (
        <div role="alert" className="aaa-flow-alert">
          {error}
        </div>
      ) : null}
      {status && !error && !refreshDialog ? (
        <p className="aaa-page-status">{status}</p>
      ) : null}

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
      <p className="aaa-queue-coverage" role="status">
        {coverageLine}
      </p>
      {remoteError ? (
        <p className="aaa-page-status" role="status">
          {remoteError}
        </p>
      ) : null}

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
          {selectedCount > 0 ? (
            <div
              className="aaa-queue-selection-toolbar"
              role="toolbar"
              aria-label="Selected request actions"
            >
              <p className="aaa-queue-selection-count">
                {selectedCount} selected
                {manualOrder ? " · custom order" : ""}
              </p>
              <button
                type="button"
                className="aaa-btn-text"
                onClick={() => moveSelection(-1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="aaa-btn-text"
                onClick={() => moveSelection(1)}
              >
                Move down
              </button>
            </div>
          ) : null}

          <div className="aaa-queue-table-wrap">
            <table className="aaa-queue-table aaa-queue-table-reviewer">
              <caption className="sr-only">
                {manualOrder
                  ? "Custom order saved in this browser"
                  : `Sorted by ${QUEUE_COLUMNS.find((column) => column.key === sort.column)?.label} ${
                      sort.direction === "asc" ? "ascending" : "descending"
                    }`}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="aaa-queue-select-col">
                    <label className="aaa-queue-select-label">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someVisibleSelected;
                        }}
                        onChange={() => toggleSelectAllVisible()}
                      />
                      <span className="sr-only">Select all visible requests</span>
                    </label>
                  </th>
                  {QUEUE_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={
                        column.key === "name"
                          ? "aaa-queue-name"
                          : column.key === "reviewerStatus"
                            ? "aaa-queue-col-status"
                            : undefined
                      }
                      aria-sort={
                        !manualOrder && column.sortable
                          ? ariaSortFor(column.key, sort)
                          : undefined
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
                            {!manualOrder && sort.column === column.key
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
                  const isSelected = selectedIds.has(row.briefId);
                  return (
                    <tr
                      key={row.briefId}
                      className={isSelected ? "is-selected" : undefined}
                    >
                      <td className="aaa-queue-select-col">
                        <label className="aaa-queue-select-label">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelected(row.briefId)}
                          />
                          <span className="sr-only">
                            Select {row.name}
                          </span>
                        </label>
                      </td>
                      <th scope="row" className="aaa-queue-name">
                        <button
                          type="button"
                          className="aaa-queue-subject"
                          title={row.name}
                          aria-label={row.name}
                          onClick={() => openSummary(row.briefId)}
                        >
                          {truncateWords(row.name, 4)}
                        </button>
                        {row.isNew ? (
                          <span className="aaa-queue-new">NEW</span>
                        ) : null}
                        {row.sentToWorkfront ? (
                          <span
                            className="aaa-queue-sent"
                            title={
                              row.workfrontIssueId
                                ? `Workfront Task ${row.workfrontIssueId}`
                                : row.sentToWorkfrontLabel
                            }
                          >
                            {row.sentToWorkfrontLabel}
                          </span>
                        ) : null}
                      </th>
                      <td className="aaa-queue-col-status">
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
                          className="aaa-btn aaa-btn-secondary aaa-queue-action-btn"
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
                        {isSelected ? (
                          <button
                            type="button"
                            className="aaa-btn aaa-btn-secondary aaa-queue-action-btn aaa-queue-action-delete"
                            onClick={() => removeLocalBrief(row.briefId, row.name)}
                          >
                            Delete
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
              const isSelected = selectedIds.has(row.briefId);
              return (
                <li
                  key={row.briefId}
                  className={
                    isSelected ? "aaa-queue-card is-selected" : "aaa-queue-card"
                  }
                >
                  <div className="aaa-queue-card-top">
                    <label className="aaa-queue-select-label">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRowSelected(row.briefId)}
                      />
                      <span className="sr-only">Select {row.name}</span>
                    </label>
                    <p className="aaa-queue-card-name" title={row.name}>
                      <span className="sr-only">{row.name}</span>
                      <span aria-hidden="true">{truncateWords(row.name, 4)}</span>
                      {row.isNew ? <span className="aaa-queue-new">NEW</span> : null}
                    </p>
                  </div>
                  <dl className="aaa-queue-card-list">
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
                      <dd>
                        {row.sentToWorkfrontLabel}
                        {row.workfrontIssueUrl ? (
                          <>
                            {" "}
                            <a
                              href={row.workfrontIssueUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open Task
                            </a>
                          </>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                  <div className="aaa-queue-actions">
                    <button
                      type="button"
                      className="aaa-btn aaa-btn-secondary aaa-queue-action-btn"
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
                    {isSelected ? (
                      <button
                        type="button"
                        className="aaa-btn aaa-btn-secondary aaa-queue-action-btn aaa-queue-action-delete"
                        onClick={() => removeLocalBrief(row.briefId, row.name)}
                      >
                        Delete
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
        Reviewer Status stays in this browser. Priority (P1–P3) is local urgency; when live submit
        is on and the row has a Workfront Task ID, changing Priority can dual-write Task priority
        (not Portfolio Optimization order). Ready to send stays local until
        Summary → Submit to Workfront Que succeeds with a real Task ID. Sent to Workfront: No is
        the default; (WF Aligned) appears only with that ID (hover the badge for the Task ID). Refresh
        loads Tasks on mission-control-v1 via the proxy — not the whole organization. Select rows
        to reorder locally or delete the local copy (Workfront Tasks are not deleted).
      </p>

      {refreshDialog ? (
        <WorkfrontRefreshDialog
          issues={refreshDialog.issues}
          linkedBriefIds={linkedBriefIds}
          onOpenSummary={(briefId) => {
            setRefreshDialog(null);
            openSummary(briefId);
          }}
          onClose={() => setRefreshDialog(null)}
        />
      ) : null}
    </section>
  );
}
