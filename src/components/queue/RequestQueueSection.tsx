/**
 * Reviewer Request Queue (Concept v1 Figma node 666:5155).
 *
 * Local Ready-to-send rows stay in this browser. Refresh upserts summary Brand Team projects
 * into local briefs (Workfront wins on match); coverage names that portfolio corpus
 * (guardrail 7). Local-only briefs without a matching project are kept.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { listAttachmentFiles } from "../../lib/intake/attachmentFileStore";
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
  type WorkfrontRemoteIssue,
} from "../../lib/workfront/proxyClient";
import {
  fetchWorkfrontHealth,
  type WorkfrontProxyHealth,
} from "../../lib/workfront/proxyHealth";
import { mergeRemoteTasksIntoBriefs } from "../../lib/workfront/mergeRemoteTasks";
import { routeFor } from "../../lib/workfront/routing";
import { submitToWorkfront } from "../../lib/workfront/submitToWorkfront";
import {
  getWorkfrontUserAuth,
  hasWorkfrontUserBearer,
} from "../../lib/workfront/userBearer";
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
  type QueueRow,
  type SortState,
} from "../../lib/workfront/queueList";
import { WorkfrontRefreshDialog } from "./WorkfrontRefreshDialog";
import { WorkfrontSentDialog } from "./WorkfrontSentDialog";

interface RefreshDialogState {
  issues: WorkfrontRemoteIssue[];
  added: number;
  updated: number;
  linked: number;
  coverage: string;
}

interface SentDialogState {
  issueId: string;
  issueUrl?: string;
  topicName: string;
  uploadedDocuments?: Array<{ name: string; taskDocumentId?: string }>;
  documentError?: string;
}

function QueueRowKebab({
  row,
  open,
  sendDisabled,
  onToggle,
  onClose,
  onSummary,
  onSendToWf,
  onParkingLot,
}: {
  row: QueueRow;
  open: boolean;
  sendDisabled?: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSummary: () => void;
  onSendToWf: () => void;
  onParkingLot: () => void;
}) {
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        closeAndRestoreFocus();
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeAndRestoreFocus]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      wrapRef.current?.querySelectorAll<HTMLButtonElement>(
        "[role='menuitem']:not([disabled])",
      ) ?? [],
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  return (
    <div className="aaa-queue-kebab" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="aaa-queue-kebab-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${row.name}`}
        onClick={onToggle}
      >
        <span className="aaa-queue-kebab-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="aaa-queue-kebab-menu"
          aria-label={`Actions for ${row.name}`}
          onKeyDown={onMenuKeyDown}
        >
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            className="aaa-queue-kebab-item"
            onClick={() => {
              onClose();
              onSummary();
            }}
          >
            Summary
          </button>
          <button
            type="button"
            role="menuitem"
            className="aaa-queue-kebab-item"
            disabled={sendDisabled}
            onClick={() => {
              onClose();
              onSendToWf();
            }}
          >
            {sendDisabled ? "Sending…" : "Send to WF"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="aaa-queue-kebab-item"
            onClick={() => {
              onClose();
              onParkingLot();
            }}
          >
            Parking Lot
          </button>
        </div>
      ) : null}
    </div>
  );
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
  const [sentDialog, setSentDialog] = useState<SentDialogState | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);
  /** Table and cards both list the same rows; mount only one so kebabs are not duplicated. */
  const [wideLayout, setWideLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : true,
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

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setWideLayout(media.matches);
      setOpenKebabId(null);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const closeKebab = useCallback(() => {
    setOpenKebabId(null);
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
            "Workfront Brand Team project search failed. Local Request Queue rows were not changed.",
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
            "Workfront Brand projects were fetched but could not be saved into this browser's Request Queue.",
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
    const summary = `Workfront refresh (Brand Team portfolio): added ${added}, updated ${updated} in this browser's Request Queue (${linked} project${linked === 1 ? "" : "s"} linked). Local-only rows without a matching project were kept.`;
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
  const parkingCount = allRows.filter(
    (row) => !row.isDraft && row.reviewerStatus === "deferred",
  ).length;
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
      return `${remoteCoverage} Refresh upserts those projects into this browser's Request Queue (Workfront wins on match). Showing ${localPart}. Not organization-wide.`;
    }
    return `Showing ${localPart}. Use Refresh from Workfront to add or update Brand Team portfolio projects into this queue.`;
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
    if (!nextOrder) return;
    const byId = new Map(briefs.map((brief) => [brief.id, brief]));
    const reordered = nextOrder
      .map((id) => byId.get(id))
      .filter((brief): brief is IntakeBrief => Boolean(brief));
    const saved = saveBriefs(reordered);
    if (!saved.ok) {
      setError(saved.reason ?? "That order could not be saved to this browser.");
      return;
    }
    setBriefs(reordered);
    setManualOrder(true);
    setError("");
    setStatus("Custom order saved in this browser.");
  }

  function removeLocalBrief(briefId: string, subject: string) {
    const confirmed = window.confirm(
      `Remove "${subject}" from this browser's Request Queue? Workfront projects are not deleted.`,
    );
    if (!confirmed) return;
    const saved = deleteBrief(briefId);
    if (!saved.ok) {
      setError(saved.reason ?? "That request could not be removed from this browser.");
      return;
    }
    setBriefs((current) => current.filter((brief) => brief.id !== briefId));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(briefId);
      return next;
    });
    setError("");
    setStatus(`Removed "${subject}" from this browser's Request Queue.`);
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
    setStatus(`Priority set to ${priority} in this browser (not sent to Workfront).`);
  }

  function moveToParkingLot(briefId: string, projectName: string) {
    updateReviewerStatus(briefId, "deferred");
    setStatus(
      `"${projectName}" moved to Parking Lot in this browser (Deferred). Nothing was sent to Workfront.`,
    );
  }

  async function sendToWorkfront(brief: IntakeBrief) {
    if (sendingId) return;

    const approvedAt = new Date().toISOString();
    const approved: IntakeBrief = {
      ...brief,
      updatedAt: approvedAt,
      reviewer: {
        ...brief.reviewer,
        status: "approved",
        firstReviewedAt: brief.reviewer.firstReviewedAt ?? approvedAt,
      },
    };
    const saved = upsertBrief(approved);
    if (!saved.ok) {
      setError(saved.reason ?? "That request could not be saved to this browser.");
      return;
    }
    setBriefs((list) =>
      list.map((item) => (item.id === approved.id ? approved : item)),
    );
    setError("");

    const alreadySent =
      approved.workfront?.mode === "workfront" && approved.workfront.issueId;
    if (alreadySent) {
      setStatus(
        `Marked Approved — transfer. Already linked to Workfront Project ${approved.workfront?.issueId}.`,
      );
      return;
    }

    const wantLive = Boolean(health?.connected && health.liveSubmit);
    if (wantLive) {
      const asSignedInUser = hasWorkfrontUserBearer();
      const signedInEmail = getWorkfrontUserAuth().email;
      const enteredByLines = asSignedInUser
        ? [
            "Entered By will be your signed-in Adobe identity" +
              (signedInEmail ? ` (${signedInEmail})` : "") +
              ", not the Server-to-Server integration account.",
          ]
        : [
            "Entered By will be the Server-to-Server integration account, not your name.",
            "Open Mission Control inside Experience Cloud Shell to submit as yourself.",
            "Your name stays in A3IntakeRequestedBy and the description audit lines.",
          ];
      const filesReady = listAttachmentFiles(approved.id).length;
      const attachmentCount = approved.attachments.length;
      const attachmentLine =
        attachmentCount === 0
          ? "No supporting files are attached."
          : filesReady === attachmentCount
            ? `${filesReady} supporting file${filesReady === 1 ? "" : "s"} will upload to the Brand project Documents → Intake folder.`
            : `${filesReady} of ${attachmentCount} file${attachmentCount === 1 ? "" : "s"} ready in this browser session. Re-attach missing files on Summary before sending, or names-only will be recorded.`;
      const confirmed = window.confirm(
        [
          "Create a Brand Team project from the Email Creative Development template?",
          "It will land in the Brand Team portfolio. Overview Description will contain the intake summary.",
          "",
          ...enteredByLines,
          "",
          attachmentLine,
        ].join("\n"),
      );
      if (!confirmed) {
        setStatus(
          "Marked Approved — transfer. Live send cancelled. Nothing was posted to Workfront.",
        );
        return;
      }
    }

    setSendingId(approved.id);
    try {
      const result = await submitToWorkfront(approved, queueConfig, {
        live: wantLive,
        confirmLive: wantLive ? true : undefined,
        attachmentFiles: listAttachmentFiles(approved.id),
      });
      if (!result.ok) {
        setError(
          `"${approved.a3.A3IntakeProjectSummary || "This request"}" is not complete yet. Still needed: ${result.missingFields.join(", ")}.`,
        );
        setStatus(
          "Marked Approved — transfer. Workfront send did not complete.",
        );
        return;
      }
      const submittedAt = new Date().toISOString();
      const next: IntakeBrief = {
        ...approved,
        status: "submitted",
        submittedAt: approved.submittedAt ?? submittedAt,
        updatedAt: submittedAt,
        workfront: {
          mode: result.mode,
          issueName: result.issueName,
          submittedAt,
          ...(result.issueId ? { issueId: result.issueId } : {}),
          ...(result.issueUrl ? { issueUrl: result.issueUrl } : {}),
          ...(result.uploadedDocuments
            ? { uploadedDocuments: result.uploadedDocuments }
            : {}),
        },
      };
      const nextSaved = upsertBrief(next);
      if (!nextSaved.ok) {
        setError(nextSaved.reason ?? "That request could not be saved to this browser.");
        return;
      }
      setBriefs((list) => list.map((item) => (item.id === next.id ? next : item)));
      setError("");
      if (result.mode === "workfront" && result.issueId) {
        const routed = routeFor(queueConfig, next);
        setSentDialog({
          issueId: result.issueId,
          issueUrl: result.issueUrl,
          topicName: routed.topic?.name ?? "",
          uploadedDocuments: result.uploadedDocuments,
          documentError: result.documentError,
        });
        setStatus(
          `Marked Approved — transfer. "${result.issueName}" created in Workfront as Brand Project ${result.issueId}.`,
        );
      } else if (wantLive && result.liveError) {
        setStatus(
          `Marked Approved — transfer. "${result.issueName}" is ready locally. Live send failed: ${result.liveError}`,
        );
      } else if (!wantLive) {
        const hint = health?.connected
          ? " Proxy is connected but live submit is off (WORKFRONT_LIVE_SUBMIT)."
          : " Workfront proxy is not connected.";
        setStatus(
          `Marked Approved — transfer. "${result.issueName}" is Ready to send in this browser.${hint}`,
        );
      } else {
        setStatus(
          `Marked Approved — transfer. "${result.issueName}" is Ready to send in this browser.`,
        );
      }
    } finally {
      setSendingId(null);
    }
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

  function renderPrioritySelect(row: QueueRow) {
    return (
      <label className="aaa-queue-priority-control">
        <span className="sr-only">Priority</span>
        <select
          className="aaa-queue-priority-select"
          value={row.priority}
          onChange={(event) =>
            updatePriority(row.briefId, event.target.value as ReviewerPriority)
          }
        >
          {REVIEWER_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function renderStatusSelect(row: QueueRow) {
    return (
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
    );
  }

  function renderRowActions(row: QueueRow, brief: IntakeBrief | undefined) {
    const isSelected = selectedIds.has(row.briefId);
    return (
      <div className="aaa-queue-actions">
        <button
          type="button"
          className="aaa-queue-summary-link"
          onClick={() => openSummary(row.briefId)}
        >
          Summary
        </button>
        <QueueRowKebab
          row={row}
          open={openKebabId === row.briefId}
          sendDisabled={sendingId !== null}
          onToggle={() =>
            setOpenKebabId((current) =>
              current === row.briefId ? null : row.briefId,
            )
          }
          onClose={closeKebab}
          onSummary={() => openSummary(row.briefId)}
          onSendToWf={() => {
            if (brief) void sendToWorkfront(brief);
          }}
          onParkingLot={() => moveToParkingLot(row.briefId, row.name)}
        />
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
                ? [
                    `Proxy health OK via ${health.endpoint}`,
                    health.brandPortfolio?.reachable
                      ? `Brand portfolio reachable via ${health.brandPortfolio.probed} (${health.brandPortfolio.projectCount} projects listed)`
                      : health.brandPortfolio?.reason
                        ? `Brand portfolio not reachable: ${health.brandPortfolio.reason}`
                        : "Brand portfolio not probed",
                    health.brandCreateConfigured
                      ? "Brand template + portfolio env set (Template Use / portfolio Manage not verified)"
                      : "Brand template/portfolio env not set on proxy",
                    health.liveSubmit ? "live submit on" : "live submit off",
                  ].join("; ")
                : health?.error
                  ? `${health.error} (checked ${health.endpoint})`
                  : "Checking the Workfront proxy…"
            }
          >
            <span className="aaa-queue-connection-dot" aria-hidden="true" />
            {health?.connected
              ? `Workfront: connected (${
                  health.brandPortfolio?.reachable
                    ? `Brand portfolio reachable (${health.brandPortfolio.projectCount} projects)`
                    : health.brandCreateConfigured
                      ? "Brand project create"
                      : "proxy only"
                }${health.liveSubmit ? "; live submit on" : ""})`
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
        {sendingId ? "Sending to Workfront…" : ""}
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
            {item.key === "parking" && parkingCount > 0 ? ` (${parkingCount})` : ""}
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
              : filter === "parking"
                ? "No Parking Lot requests in this browser."
                : filter === "closed"
                  ? "No closed requests in this browser."
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

          {wideLayout ? (
          <div className="aaa-queue-table-wrap" key="queue-table">
            <table className="aaa-queue-table aaa-queue-table-reviewer aaa-queue-table-v1">
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
                          : column.key === "description"
                            ? "aaa-queue-col-description"
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
                  <th scope="col">Summary</th>
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
                          <span className="sr-only">Select {row.name}</span>
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
                          {truncateWords(row.name, 6)}
                        </button>
                        {row.isNew ? (
                          <span className="aaa-queue-new">NEW</span>
                        ) : null}
                        {row.sentToWorkfront ? (
                          <span
                            className="aaa-queue-sent"
                            title={
                              row.workfrontIssueId
                                ? `Workfront Project ${row.workfrontIssueId}`
                                : row.sentToWorkfrontLabel
                            }
                          >
                            {row.sentToWorkfrontLabel}
                          </span>
                        ) : null}
                      </th>
                      <td>{row.requesterName}</td>
                      <td className="aaa-queue-col-description" title={row.description}>
                        {row.description
                          ? truncateWords(row.description, 8)
                          : ""}
                      </td>
                      <td>{formatQueueDate(row.entryDate)}</td>
                      <td>{formatQueueDate(row.dueDate)}</td>
                      <td>{renderPrioritySelect(row)}</td>
                      <td className="aaa-queue-col-status">{renderStatusSelect(row)}</td>
                      <td>
                        <button
                          type="button"
                          className="aaa-queue-summary-link"
                          onClick={() => openSummary(row.briefId)}
                        >
                          Summary
                        </button>
                      </td>
                      <td className="aaa-queue-actions-cell">
                        <QueueRowKebab
                          row={row}
                          open={openKebabId === row.briefId}
                          sendDisabled={sendingId !== null}
                          onToggle={() =>
                            setOpenKebabId((current) =>
                              current === row.briefId ? null : row.briefId,
                            )
                          }
                          onClose={closeKebab}
                          onSummary={() => openSummary(row.briefId)}
                          onSendToWf={() => {
                            if (brief) void sendToWorkfront(brief);
                          }}
                          onParkingLot={() =>
                            moveToParkingLot(row.briefId, row.name)
                          }
                        />
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
          ) : (
          <ul className="aaa-queue-cards" role="list" key="queue-cards">
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
                      <span aria-hidden="true">{truncateWords(row.name, 6)}</span>
                      {row.isNew ? <span className="aaa-queue-new">NEW</span> : null}
                    </p>
                  </div>
                  <dl className="aaa-queue-card-list">
                    <div>
                      <dt>Owner</dt>
                      <dd>{row.requesterName}</dd>
                    </div>
                    <div>
                      <dt>Description</dt>
                      <dd>{row.description || "—"}</dd>
                    </div>
                    <div>
                      <dt>Entry Date</dt>
                      <dd>{formatQueueDate(row.entryDate) || "—"}</dd>
                    </div>
                    <div>
                      <dt>Due Date</dt>
                      <dd>{formatQueueDate(row.dueDate) || "—"}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{renderPrioritySelect(row)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{renderStatusSelect(row)}</dd>
                    </div>
                  </dl>
                  {renderRowActions(row, brief)}
                </li>
              );
            })}
          </ul>
          )}
        </>
      )}

      <p className="aaa-queue-footnote">
        Reviewer Status and Priority are saved in this browser only. Parking Lot marks a request
        Deferred locally and does not send it to Workfront. Ready to send stays local until Summary
        or Send to WF succeeds with a real Brand Project ID. Sent to Workfront: No is the default;
        (WF Aligned) appears only with that ID. Refresh loads Brand Team portfolio projects via the
        proxy — not the whole organization. Select rows to reorder locally or delete the local copy
        (Workfront projects are not deleted).
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

      {sentDialog ? (
        <WorkfrontSentDialog
          issueId={sentDialog.issueId}
          issueUrl={sentDialog.issueUrl}
          topicName={sentDialog.topicName}
          uploadedDocuments={sentDialog.uploadedDocuments}
          documentError={sentDialog.documentError}
          onClose={() => setSentDialog(null)}
          onViewQueue={() => setSentDialog(null)}
        />
      ) : null}
    </section>
  );
}
