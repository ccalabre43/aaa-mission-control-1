/**
 * Executive dashboard tab: Figma Concept v1 2×3 cards.
 *
 * Queue counts and escalations use briefs saved in this browser. Hours, capacity, and speed-to-
 * decision stay placeholders until a Workfront assignment / Resource Planner adapter is approved
 * (guardrail 7). Does not invent utilization percentages from the prototype.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { loadBriefs } from "../../lib/intake/storage";
import {
  REVIEWER_STATUSES,
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
    for (const row of ready) {
      byStatus[row.reviewerStatus] += 1;
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

    return {
      readyCount: ready.length,
      byStatus,
      byTrackerStatus,
      otherTracker,
      activeJobs,
      completeJobs,
      trackerCount: trackerRows.length,
      escalations,
      dueSoon,
    };
  }, [trackerRows, dataEpoch]);

  const statusParts = REVIEWER_STATUSES.map((item) => ({
    key: item.value,
    count: summary.byStatus[item.value],
    className: STATUS_BAR[item.value],
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

  return (
    <section className="aaa-exec" aria-labelledby="exec-heading">
      <header className="aaa-queue-hero aaa-exec-hero">
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
            <h2 id="exec-heading" className="aaa-queue-heading">
              Executive dashboard
            </h2>
            <p className="aaa-queue-sub">
              How the team is doing on requests that clear the reviewer queue.
            </p>
          </div>
        </div>
      </header>

      <p className="aaa-exec-eyebrow">Queue figures update as you review · this week</p>

      <div className="aaa-exec-board">
        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">How busy is the team</h3>
            <p className="aaa-exec-chip aaa-exec-chip-muted">Not connected</p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">—</span>
            <span className="aaa-exec-stat-unit">% booked</span>
          </p>
          <div className="aaa-exec-bar is-empty" aria-hidden="true">
            <span className="aaa-exec-bar-empty" />
          </div>
          <p className="aaa-exec-caption">
            Planned vs required hours need Workfront assignment fields (`work`, `workRequired`,
            `percentComplete`) through the proxy. This card does not invent a booking percentage.
          </p>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Team capacity</h3>
            <p className="aaa-exec-chip aaa-exec-chip-ok">Placeholder</p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">—</span>
            <span className="aaa-exec-stat-unit">hrs open</span>
          </p>
          <p className="aaa-exec-caption">
            Forward capacity needs Resource Planner (or equivalent) access — a Vendor Management
            and API decision. Week bars stay empty until that feed exists.
          </p>
          <div className="aaa-exec-weeks" aria-hidden="true">
            {["This week", "Wk 2", "Wk 3", "Wk 4"].map((label) => (
              <div key={label} className="aaa-exec-week">
                <span className="aaa-exec-week-col" />
                <span className="aaa-exec-week-label">{label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Jobs in motion</h3>
            <p className="aaa-exec-chip aaa-exec-chip-muted">
              {summary.completeJobs} complete
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
                  {status}
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

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Requests through the queue</h3>
            <p className="aaa-exec-chip aaa-exec-chip-info">
              {summary.byStatus.needs_review} awaiting review
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
            {REVIEWER_STATUSES.map((item) => (
              <li key={item.value}>
                <span>
                  <span className={`aaa-exec-dot ${STATUS_BAR[item.value]}`} aria-hidden="true" />
                  {item.label}
                </span>
                <span>{summary.byStatus[item.value]}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Speed to decision</h3>
            <p className="aaa-exec-chip aaa-exec-chip-ok">Placeholder</p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">—</span>
            <span className="aaa-exec-stat-unit">days avg</span>
          </p>
          <p className="aaa-exec-caption">
            From request submitted to reviewer decision. Target is 3 days or less. This browser
            does not store a decision timestamp that can support that average yet.
          </p>
          <p className="aaa-exec-caption aaa-exec-caption-split">
            Delivered on time, last 30 days
            <strong>—</strong>
          </p>
        </article>

        <article className="aaa-exec-panel">
          <div className="aaa-exec-panel-head">
            <h3 className="aaa-exec-panel-title">Needs leadership attention</h3>
            <p className="aaa-exec-chip aaa-exec-chip-alert">
              {summary.escalations.length === 1
                ? "1 to decide"
                : `${summary.escalations.length} to decide`}
            </p>
          </div>
          <p className="aaa-exec-stat">
            <span className="aaa-exec-stat-value">{summary.escalations.length}</span>
            <span className="aaa-exec-stat-unit">
              {summary.escalations.length === 1 ? "escalation" : "escalations"}
            </span>
          </p>
          {summary.escalations.length === 0 ? (
            <p className="aaa-exec-empty">No escalated requests in this browser.</p>
          ) : (
            <ul className="aaa-exec-attention" role="list">
              {summary.escalations.slice(0, 3).map((row) => (
                <li key={row.briefId}>
                  <Link
                    className="aaa-exec-attention-link"
                    to={`/deliverables/requests/${row.briefId}`}
                  >
                    {row.name}
                  </Link>
                  <span>
                    {row.requesterName} · awaiting a leadership decision
                  </span>
                </li>
              ))}
            </ul>
          )}
          {summary.dueSoon.length > 0 ? (
            <div className="aaa-exec-duesoon">
              <p className="aaa-exec-duesoon-title">
                {summary.dueSoon.length === 1
                  ? "1 job due within 7 days"
                  : `${summary.dueSoon.length} jobs due within 7 days`}
              </p>
              <p>Local tracker dates in this browser — less than complete.</p>
            </div>
          ) : (
            <p className="aaa-exec-caption">
              No incomplete tracker jobs with a due date in the next 7 days in this browser.
            </p>
          )}
        </article>
      </div>

      <p className="aaa-exec-coverage" role="note">
        Queue counts and escalations are from requests saved in this browser. Hours, capacity,
        turnaround, and on-time delivery are placeholders until a Workfront assignment / Resource
        Planner feed is connected — not organization-wide.
      </p>
    </section>
  );
}
