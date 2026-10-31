/**
 * Executive dashboard tab: Figma Concept v1 “Executive dashboard 2” (node 469-7289).
 *
 * Queue counts, jobs in motion, and escalations use this browser. Hours, capacity, speed,
 * reporting week, and portfolio tables show labeled Concept v1 illustrative figures until a
 * Workfront assignment / Resource Planner adapter is approved (guardrail 7).
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PortfolioOrderPanel } from "../executive/PortfolioOrderPanel";
import {
  EXEC_DEMO_BUSY,
  EXEC_DEMO_CAPACITY,
  EXEC_DEMO_COMPLETED_WORK,
  EXEC_DEMO_COVERAGE,
  EXEC_DEMO_REPORTING_WEEK,
  EXEC_DEMO_SELECTED_STATUS,
  EXEC_DEMO_SPEED,
  type ExecSelectedStatusRow,
} from "../../lib/dashboard/executiveDemoFigures";
import { loadBriefs } from "../../lib/intake/storage";
import {
  REVIEWER_PRIORITIES,
  REVIEWER_STATUSES,
  type ReviewerPriority,
  type ReviewerStatus,
} from "../../lib/intake/types";
import { STATUS_OPTIONS, type TrackerRow } from "../../lib/types";
import { loadQueueConfig } from "../../lib/workfront/queueConfig";
import { toQueueRow, type QueueRow, type Viewer } from "../../lib/workfront/queueList";

interface ExecutiveDashboardSectionProps {
  trackerRows: TrackerRow[];
  dataEpoch: number;
}

const STATUS_BAR: Record<ReviewerStatus, string> = {
  approved: "aaa-exec-seg-approved",
  needs_review: "aaa-exec-seg-review",
  needs_clarification: "aaa-exec-seg-clarify",
  deferred: "aaa-exec-seg-deferred",
  escalated: "aaa-exec-seg-escalated",
  closed: "aaa-exec-seg-closed",
};

/** Figma display labels; storage values stay REVIEWER_STATUSES. */
const QUEUE_STATUS_LABEL: Record<ReviewerStatus, string> = {
  approved: "Accepted",
  needs_review: "Awaiting review",
  needs_clarification: "Returned for clarification",
  deferred: "Deferred",
  escalated: "Escalated",
  closed: "Closed",
};

/** Figma jobs-in-motion labels mapped from tracker STATUS_OPTIONS. */
const JOB_STATUS_LABEL: Record<(typeof STATUS_OPTIONS)[number], string> = {
  "Not started": "Kickoff",
  "In progress": "In production",
  Blocked: "Blocked",
  Complete: "Final review",
};

const QUEUE_LEGEND_ORDER: ReviewerStatus[] = [
  "approved",
  "needs_review",
  "needs_clarification",
  "deferred",
  "escalated",
];

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const due = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - start.getTime()) / 86400000);
}

function SegmentBar({
  parts,
  emptyLabel,
}: {
  parts: { key: string; count: number; className: string }[];
  emptyLabel: string;
}) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (total === 0) {
    return (
      <div className="aaa-exec-bar is-empty" aria-label={emptyLabel}>
        <span className="aaa-exec-bar-empty" />
      </div>
    );
  }
  return (
    <div className="aaa-exec-bar" aria-hidden="true">
      {parts.map((part) =>
        part.count > 0 ? (
          <span
            key={part.key}
            className={`aaa-exec-bar-seg ${part.className}`}
            style={{ flexGrow: part.count }}
          />
        ) : null,
      )}
    </div>
  );
}

export function ExecutiveDashboardSection({
  trackerRows,
  dataEpoch,
}: ExecutiveDashboardSectionProps) {
  const summary = useMemo(() => {
    const briefs = loadBriefs().briefs;
    const config = loadQueueConfig().config;
    const viewer: Viewer = { firstName: "", lastName: "", email: "" };
    const rows = briefs.map((brief) => toQueueRow(brief, config, viewer));
    const ready = rows.filter((row) => !row.isDraft);

    const byStatus = Object.fromEntries(
      REVIEWER_STATUSES.map((item) => [item.value, 0]),
    ) as Record<ReviewerStatus, number>;
    const byPriority = Object.fromEntries(
      REVIEWER_PRIORITIES.map((priority) => [priority, 0]),
    ) as Record<ReviewerPriority, number>;
    for (const row of ready) {
      byStatus[row.reviewerStatus] += 1;
      byPriority[row.priority] += 1;
    }

    const byTrackerStatus = Object.fromEntries(
      STATUS_OPTIONS.map((status) => [status, 0]),
    ) as Record<(typeof STATUS_OPTIONS)[number], number>;
    let otherTracker = 0;
    for (const row of trackerRows) {
      if (row.status in byTrackerStatus) {
        byTrackerStatus[row.status as (typeof STATUS_OPTIONS)[number]] += 1;
      } else {
        otherTracker += 1;
      }
    }

    const activeJobs = trackerRows.filter((row) => row.status !== "Complete").length;
    const completeJobs = byTrackerStatus.Complete;

    const escalations: QueueRow[] = ready.filter(
      (row) => row.reviewerStatus === "escalated",
    );

    const dueSoon = trackerRows.filter((row) => {
      if (row.status === "Complete") return false;
      const days = daysUntil(row.estimatedCompletionDate);
      return days != null && days >= 0 && days <= 7;
    });

    const selectedFromLive: ExecSelectedStatusRow[] = escalations.slice(0, 5).map((row) => ({
      project: row.name,
      client: row.requesterDepartment || "—",
      description:
        row.blockers.length > 0
          ? row.blockers.join("; ")
          : "Escalated for leadership review.",
      execReview: "Y" as const,
      effort: "—",
      owner: row.requesterName || "—",
      targetEnd: "—",
      briefId: row.briefId,
    }));

    return {
      readyCount: ready.length,
      byStatus,
      byPriority,
      byTrackerStatus,
      otherTracker,
      activeJobs,
      completeJobs,
      trackerCount: trackerRows.length,
      escalations,
      dueSoon,
      selectedRows:
        selectedFromLive.length > 0 ? selectedFromLive : [...EXEC_DEMO_SELECTED_STATUS],
      selectedFromLive: selectedFromLive.length > 0,
    };
  }, [trackerRows, dataEpoch]);

  const statusParts = QUEUE_LEGEND_ORDER.map((value) => ({
    key: value,
    count: summary.byStatus[value],
    className: STATUS_BAR[value],
  }));

  const motionParts = [
    ...STATUS_OPTIONS.map((status) => ({
      key: status,
      count: summary.byTrackerStatus[status],
      className: `aaa-exec-seg-job-${status.toLowerCase().replace(/\s+/g, "-")}`,
    })),
    ...(summary.otherTracker
      ? [
          {
            key: "other",
            count: summary.otherTracker,
            className: "aaa-exec-seg-deferred",
          },
        ]
      : []),
  ];

  const decideChip =
    summary.escalations.length === 1
      ? "1 to decide"
      : `${summary.escalations.length} to decide`;

  const firstEscalation = summary.escalations[0];

  return (
    <section className="aaa-exec" aria-labelledby="exec-heading">
      <header className="aaa-exec-hero">
        <h2 id="exec-heading" className="aaa-exec-page-title">
          Executive dashboard
        </h2>
        <p className="aaa-exec-page-sub">
          How the team is doing based on our intake information.
        </p>
      </header>

      <div className="aaa-exec-portfolio-head">
        <h3 className="aaa-exec-portfolio-title">Team Portfolio</h3>
        <p className="aaa-exec-portfolio-week">
          Reporting Week: {EXEC_DEMO_REPORTING_WEEK}
        </p>
      </div>

      <p className="aaa-exec-priority-counts" role="note">
        Request Queue urgency (this browser
        {summary.readyCount > 0 ? `, ${summary.readyCount} ready` : ""}
        ):{" "}
        {REVIEWER_PRIORITIES.map((priority, index) => (
          <span key={priority}>
            {index > 0 ? " · " : ""}
            {priority} {summary.byPriority[priority]}
          </span>
        ))}
        . Separate from Portfolio Optimization project order below.
      </p>

      <PortfolioOrderPanel />

      <div className="aaa-exec-board">
        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">How busy is the team</h3>
            <p className="aaa-exec-chip aaa-exec-chip-busy">{EXEC_DEMO_BUSY.chip}</p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">{EXEC_DEMO_BUSY.bookedPercent}</span>
            <span className="aaa-exec-stat-unit">% booked</span>
          </p>
          <div
            className="aaa-exec-bar"
            role="img"
            aria-label={`${EXEC_DEMO_BUSY.bookedPercent} percent booked this week, illustrative Concept v1 figure`}
          >
            <span
              className="aaa-exec-bar-seg aaa-exec-seg-busy"
              style={{ flexGrow: EXEC_DEMO_BUSY.bookedPercent }}
            />
            <span
              className="aaa-exec-bar-seg aaa-exec-bar-remainder"
              style={{ flexGrow: 100 - EXEC_DEMO_BUSY.bookedPercent }}
              aria-hidden="true"
            />
          </div>
          <p className="aaa-exec-caption">{EXEC_DEMO_BUSY.caption}</p>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Team capacity</h3>
            <p className="aaa-exec-chip aaa-exec-chip-ok">{EXEC_DEMO_CAPACITY.chip}</p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">{EXEC_DEMO_CAPACITY.hoursOpen}</span>
            <span className="aaa-exec-stat-unit">hrs open</span>
          </p>
          <p className="aaa-exec-caption">{EXEC_DEMO_CAPACITY.caption}</p>
          <div
            className="aaa-exec-weeks"
            role="img"
            aria-label="Illustrative forward capacity by week from Concept v1"
          >
            {EXEC_DEMO_CAPACITY.weeks.map((week) => (
              <div key={week.label} className="aaa-exec-week">
                <span className="aaa-exec-week-pct">{week.percentLabel}</span>
                <span className="aaa-exec-week-track">
                  <span
                    className={
                      week.emphasis
                        ? "aaa-exec-week-col aaa-exec-week-col-emphasis"
                        : "aaa-exec-week-col"
                    }
                    style={{ height: `${week.fillPercent}%` }}
                  />
                </span>
                <span className="aaa-exec-week-label">{week.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Executive review this week</h3>
            <p className="aaa-exec-chip aaa-exec-chip-alert">{decideChip}</p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">{summary.escalations.length}</span>
            <span className="aaa-exec-stat-unit">
              {summary.escalations.length === 1 ? "escalation" : "escalations"}
            </span>
          </p>
          <div className="aaa-exec-callouts">
            {firstEscalation ? (
              <div className="aaa-exec-callout aaa-exec-callout-alert">
                <p className="aaa-exec-callout-title">
                  <Link
                    className="aaa-exec-attention-link"
                    to={`/deliverables/requests/${firstEscalation.briefId}`}
                  >
                    {firstEscalation.name}
                  </Link>
                </p>
                <p className="aaa-exec-callout-meta">
                  {firstEscalation.requesterName} · awaiting a leadership decision
                </p>
              </div>
            ) : (
              <div className="aaa-exec-callout aaa-exec-callout-alert">
                <p className="aaa-exec-callout-title">No escalations in this browser</p>
                <p className="aaa-exec-callout-meta">
                  Live escalated requests from the local queue appear here.
                </p>
              </div>
            )}
            <div className="aaa-exec-callout aaa-exec-callout-due">
              <p className="aaa-exec-callout-title">
                {summary.dueSoon.length === 1
                  ? "1 job due within 7 days"
                  : `${summary.dueSoon.length} jobs due within 7 days`}
              </p>
              <p className="aaa-exec-callout-meta">
                {summary.dueSoon.length > 0
                  ? "Local tracker dates in this browser — less than complete."
                  : "No incomplete tracker jobs with a due date in the next 7 days in this browser."}
              </p>
            </div>
          </div>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Requests through the queue</h3>
            <p className="aaa-exec-chip aaa-exec-chip-info">
              {summary.byStatus.needs_review === 1
                ? "1 awaiting review"
                : `${summary.byStatus.needs_review} awaiting review`}
            </p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">{summary.readyCount}</span>
            <span className="aaa-exec-stat-unit">
              {summary.readyCount === 1 ? "request" : "requests"}
            </span>
          </p>
          <SegmentBar
            parts={statusParts}
            emptyLabel="No ready-to-send requests in this browser"
          />
          <ul className="aaa-exec-legend" role="list">
            {QUEUE_LEGEND_ORDER.map((value) => (
              <li key={value}>
                <span>
                  <span className={`aaa-exec-dot ${STATUS_BAR[value]}`} aria-hidden="true" />
                  {QUEUE_STATUS_LABEL[value]}
                </span>
                <span>{summary.byStatus[value]}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Speed to completion</h3>
            <p className="aaa-exec-chip aaa-exec-chip-ok">{EXEC_DEMO_SPEED.chip}</p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">{EXEC_DEMO_SPEED.daysAvg}</span>
            <span className="aaa-exec-stat-unit">days avg</span>
          </p>
          <p className="aaa-exec-caption">{EXEC_DEMO_SPEED.caption}</p>
          <p className="aaa-exec-caption aaa-exec-caption-split">
            Delivered on time, last 30 days
            <strong>{EXEC_DEMO_SPEED.onTimePercent}%</strong>
          </p>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Jobs in motion</h3>
            <p className="aaa-exec-chip aaa-exec-chip-muted">
              {summary.completeJobs} done this month
            </p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">{summary.activeJobs}</span>
            <span className="aaa-exec-stat-unit">active jobs</span>
          </p>
          <SegmentBar
            parts={motionParts}
            emptyLabel="No project-tracker rows in this browser"
          />
          <ul className="aaa-exec-legend" role="list">
            {STATUS_OPTIONS.map((status) => (
              <li key={status}>
                <span>
                  <span
                    className={`aaa-exec-dot aaa-exec-seg-job-${status.toLowerCase().replace(/\s+/g, "-")}`}
                    aria-hidden="true"
                  />
                  {JOB_STATUS_LABEL[status]}
                </span>
                <span>{summary.byTrackerStatus[status]}</span>
              </li>
            ))}
          </ul>
          <p className="aaa-exec-caption">
            From project-tracker rows saved in this browser (`aaa-project-tracker`), not Workfront
            projects.
          </p>
        </article>
      </div>

      <section className="aaa-exec-table-block" aria-labelledby="exec-selected-heading">
        <div className="aaa-exec-table-card aaa-exec-table-card-selected">
          <h3 id="exec-selected-heading" className="aaa-exec-table-title">
            Items flagged for review
          </h3>
          <p className="aaa-exec-table-note" role="note">
            {summary.selectedFromLive
              ? "Rows mapped from escalated requests saved in this browser."
              : "Illustrative Concept v1 rows (Figma) — not Workfront. Live escalations replace these when present."}
          </p>
          <div className="aaa-exec-table-wrap">
            <table className="aaa-exec-data-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Client</th>
                  <th scope="col">Description</th>
                  <th scope="col">Exec Review</th>
                  <th scope="col">Effort</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Target End</th>
                </tr>
              </thead>
              <tbody>
                {summary.selectedRows.map((row, index) => (
                  <tr key={row.briefId ?? `${row.project}-${index}`}>
                    <td>
                      {row.briefId ? (
                        <Link
                          className="aaa-exec-attention-link"
                          to={`/deliverables/requests/${row.briefId}`}
                        >
                          {row.project}
                        </Link>
                      ) : (
                        row.project
                      )}
                    </td>
                    <td>{row.client}</td>
                    <td className="aaa-exec-table-desc">{row.description}</td>
                    <td>{row.execReview}</td>
                    <td>{row.effort}</td>
                    <td>{row.owner}</td>
                    <td>{row.targetEnd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="aaa-exec-table-actions">
            <Link to="/deliverables" className="aaa-btn aaa-btn-secondary">
              View all
            </Link>
          </p>
        </div>
      </section>

      <section className="aaa-exec-table-block" aria-labelledby="exec-completed-heading">
        <div className="aaa-exec-table-card aaa-exec-table-card-completed">
          <h3 id="exec-completed-heading" className="aaa-exec-table-title">
            Completed work
          </h3>
          <p className="aaa-exec-table-note" role="note">
            Illustrative Concept v1 rows (Figma node 469-7289) — not a Workfront completion feed.
          </p>
          <div className="aaa-exec-table-wrap">
            <table className="aaa-exec-data-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Client</th>
                  <th scope="col">Requested Date</th>
                  <th scope="col">Completed Date</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Outcome/Notes</th>
                </tr>
              </thead>
              <tbody>
                {EXEC_DEMO_COMPLETED_WORK.map((row, index) => (
                  <tr key={`${row.project}-${index}`}>
                    <td>{row.project}</td>
                    <td>{row.client}</td>
                    <td>{row.requestedDate}</td>
                    <td>{row.completedDate}</td>
                    <td>{row.owner}</td>
                    <td>{row.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="aaa-exec-table-actions">
            <Link to="/deliverables" className="aaa-btn aaa-btn-secondary">
              View all
            </Link>
          </p>
        </div>
      </section>

      <p className="aaa-exec-coverage" role="note">
        {EXEC_DEMO_COVERAGE}
      </p>
    </section>
  );
}
