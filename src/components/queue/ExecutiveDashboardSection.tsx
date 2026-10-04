/**
 * Executive dashboard tab: local workload summaries plus stubs for hours/capacity.
 *
 * Figures are computed only from briefs and tracker rows saved in this browser. That coverage is
 * stated in the UI (guardrail 7). Live Workfront Resource Planner / assignment hours are out of
 * scope until a typed adapter and Vendor Management approval exist.
 */
import { useMemo } from "react";
import { loadBriefs } from "../../lib/intake/storage";
import {
  REVIEWER_PRIORITIES,
  REVIEWER_STATUSES,
  reviewerStatusLabel,
  type ReviewerPriority,
  type ReviewerStatus,
} from "../../lib/intake/types";
import { loadQueueConfig } from "../../lib/workfront/queueConfig";
import { toQueueRow, type Viewer } from "../../lib/workfront/queueList";
import type { TrackerRow } from "../../lib/types";

interface ExecutiveDashboardSectionProps {
  trackerRows: TrackerRow[];
  dataEpoch: number;
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
    const drafts = rows.filter((row) => row.isDraft);

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

    const byTeam: Record<string, number> = {};
    for (const brief of briefs) {
      if (brief.status !== "submitted") continue;
      const raw = brief.a3.A3IntakeCommunicationType ?? "Unassigned";
      const teams = raw.split(",").map((part) => part.trim()).filter(Boolean);
      for (const team of teams.length ? teams : ["Unassigned"]) {
        byTeam[team] = (byTeam[team] ?? 0) + 1;
      }
    }

    return {
      readyCount: ready.length,
      draftCount: drafts.length,
      openCount: ready.filter((row) => row.isOpen).length,
      byStatus,
      byPriority,
      byTeam,
      trackerCount: trackerRows.length,
    };
    // dataEpoch forces re-read after snapshot import / sample load.
  }, [trackerRows, dataEpoch]);

  return (
    <section className="aaa-exec" aria-labelledby="exec-heading">
      <div className="aaa-queue-hero">
        <div className="aaa-queue-hero-main">
          <div className="aaa-queue-hero-icon aaa-exec-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h2 id="exec-heading" className="aaa-queue-heading">
              Executive dashboard
            </h2>
            <p className="aaa-queue-sub">
              Team workload snapshot from requests and tracker rows saved in this browser.
            </p>
          </div>
        </div>
      </div>

      <p className="aaa-exec-coverage" role="note">
        Based on requests and project-tracker rows saved in this browser — not Workfront Resource
        Planner, and not organization-wide capacity.
      </p>

      <div className="aaa-exec-cards">
        <article className="aaa-exec-card">
          <h3 className="aaa-exec-card-label">Ready to send</h3>
          <p className="aaa-exec-card-value">{summary.readyCount}</p>
        </article>
        <article className="aaa-exec-card">
          <h3 className="aaa-exec-card-label">Open in review</h3>
          <p className="aaa-exec-card-value">{summary.openCount}</p>
        </article>
        <article className="aaa-exec-card">
          <h3 className="aaa-exec-card-label">Drafts</h3>
          <p className="aaa-exec-card-value">{summary.draftCount}</p>
        </article>
        <article className="aaa-exec-card">
          <h3 className="aaa-exec-card-label">Tracker rows</h3>
          <p className="aaa-exec-card-value">{summary.trackerCount}</p>
        </article>
      </div>

      <div className="aaa-exec-grid">
        <section aria-labelledby="exec-status-heading">
          <h3 id="exec-status-heading" className="aaa-exec-section-heading">
            By reviewer status
          </h3>
          <ul className="aaa-exec-list" role="list">
            {REVIEWER_STATUSES.map((item) => (
              <li key={item.value}>
                <span>{reviewerStatusLabel(item.value)}</span>
                <span>{summary.byStatus[item.value]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="exec-priority-heading">
          <h3 id="exec-priority-heading" className="aaa-exec-section-heading">
            By priority
          </h3>
          <ul className="aaa-exec-list" role="list">
            {REVIEWER_PRIORITIES.map((priority) => (
              <li key={priority}>
                <span>{priority}</span>
                <span>{summary.byPriority[priority]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="exec-team-heading">
          <h3 id="exec-team-heading" className="aaa-exec-section-heading">
            By communication type
          </h3>
          <ul className="aaa-exec-list" role="list">
            {Object.keys(summary.byTeam).length === 0 ? (
              <li>
                <span>No ready-to-send requests yet</span>
                <span>0</span>
              </li>
            ) : (
              Object.entries(summary.byTeam).map(([team, count]) => (
                <li key={team}>
                  <span>{team}</span>
                  <span>{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="aaa-exec-stubs">
        <article className="aaa-exec-stub">
          <h3 className="aaa-exec-section-heading">Hours</h3>
          <p>
            Planned and actual hours activate when Workfront assignment fields (`work`,
            `workRequired`, `percentComplete`) are connected through the proxy. No hours are
            invented here.
          </p>
        </article>
        <article className="aaa-exec-stub">
          <h3 className="aaa-exec-section-heading">Team capacity</h3>
          <p>
            Capacity and utilization need Resource Planner (or equivalent) access — a separate Vendor
            Management and API decision. See docs/knowledge/reviewer-queue-fields.md.
          </p>
        </article>
      </div>
    </section>
  );
}
