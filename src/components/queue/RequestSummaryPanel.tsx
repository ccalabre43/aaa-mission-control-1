/**
 * Summary panel for a selected request.
 *
 * Includes local reviewer Status/Priority editors (not Workfront-bound yet) plus Path, send state,
 * and the Workfront payload preview so the connection to the A3 form is not lost.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { groupA3BySection } from "../../lib/intake/a3Schema";
import {
  REVIEWER_PRIORITIES,
  REVIEWER_STATUSES,
  briefStatusLabel,
  type BriefReviewer,
  type IntakeBrief,
  type ReviewerPriority,
  type ReviewerStatus,
} from "../../lib/intake/types";
import { describeCoverageForAudit } from "../../lib/related/coverage";
import type { QueueDef } from "../../lib/workfront/queueConfig";
import { buildWorkfrontPayload } from "../../lib/workfront/submitToWorkfront";
import type { QueueRow } from "../../lib/workfront/queueList";
import { routeExplanation, routeFor } from "../../lib/workfront/routing";

interface RequestSummaryPanelProps {
  brief: IntakeBrief;
  row: QueueRow;
  queueConfig: QueueDef;
  onClose: () => void;
  onUpdateReviewer: (next: Partial<BriefReviewer>) => void;
}

type PanelTab = "summary" | "payload";

export function RequestSummaryPanel({
  brief,
  row,
  queueConfig,
  onClose,
  onUpdateReviewer,
}: RequestSummaryPanelProps) {
  const [tab, setTab] = useState<PanelTab>("summary");
  const [showFull, setShowFull] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const route = useMemo(() => routeFor(queueConfig, brief), [queueConfig, brief]);
  const grouped = useMemo(() => groupA3BySection(brief.a3), [brief.a3]);
  const payload = useMemo(
    () => buildWorkfrontPayload(brief, queueConfig),
    [brief, queueConfig],
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const reviewFlags = brief.complianceFlags.filter((flag) => flag.severity === "review");

  return (
    <div className="aaa-panel-scrim" onClick={onClose}>
      <div
        ref={panelRef}
        className="aaa-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-panel-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aaa-panel-head">
          <h2
            id="summary-panel-heading"
            className="aaa-panel-heading"
            tabIndex={-1}
            ref={headingRef}
          >
            {row.name}
          </h2>
          <button type="button" className="aaa-btn-text" onClick={onClose}>
            Close
            <span className="sr-only"> the summary panel</span>
          </button>
        </div>

        <div className="aaa-panel-tabs" role="tablist" aria-label="Request views">
          <button
            type="button"
            role="tab"
            id="tab-summary"
            aria-selected={tab === "summary"}
            aria-controls="panel-summary"
            className={tab === "summary" ? "aaa-panel-tab is-active" : "aaa-panel-tab"}
            onClick={() => setTab("summary")}
          >
            Summary
          </button>
          <button
            type="button"
            role="tab"
            id="tab-payload"
            aria-selected={tab === "payload"}
            aria-controls="panel-payload"
            className={tab === "payload" ? "aaa-panel-tab is-active" : "aaa-panel-tab"}
            onClick={() => setTab("payload")}
          >
            Workfront payload
          </button>
        </div>

        {tab === "summary" ? (
          <div id="panel-summary" role="tabpanel" aria-labelledby="tab-summary">
            <section
              className="aaa-panel-reviewer"
              aria-labelledby="panel-reviewer-heading"
            >
              <h3 id="panel-reviewer-heading" className="aaa-panel-section-heading">
                Reviewer (local)
              </h3>
              <p className="aaa-panel-reason">
                Saved in this browser only. Not included in the Workfront payload yet.
              </p>
              <div className="aaa-panel-reviewer-fields">
                <label>
                  Status
                  <select
                    value={brief.reviewer.status}
                    onChange={(event) =>
                      onUpdateReviewer({
                        status: event.target.value as ReviewerStatus,
                      })
                    }
                  >
                    {REVIEWER_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={brief.reviewer.priority}
                    onChange={(event) =>
                      onUpdateReviewer({
                        priority: event.target.value as ReviewerPriority,
                      })
                    }
                  >
                    {REVIEWER_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <dl className="aaa-panel-list">
              <div>
                <dt>ALAN number</dt>
                <dd>{brief.alanNumber ?? "None yet - new piece"}</dd>
              </div>
              <div>
                <dt>Lifecycle</dt>
                <dd>{briefStatusLabel(brief.status)}</dd>
              </div>
              <div>
                <dt>Channels</dt>
                <dd>{row.channels.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Sent to Workfront</dt>
                <dd>No</dd>
              </div>
              <div>
                <dt>Path</dt>
                <dd>
                  {row.path}
                  <span className="aaa-panel-reason">{routeExplanation(route)}</span>
                </dd>
              </div>
              <div>
                <dt>Requestor</dt>
                <dd>
                  {row.requesterName}
                  {row.requesterDepartment ? `, ${row.requesterDepartment}` : ""}
                </dd>
              </div>
              <div>
                <dt>Duplicate check</dt>
                <dd>{describeCoverageForAudit(brief.matchCoverage)}</dd>
              </div>
            </dl>

            {brief.resolvedMatches.length > 0 ? (
              <section aria-labelledby="panel-matches">
                <h3 id="panel-matches" className="aaa-panel-section-heading">
                  Related work the requester reviewed
                </h3>
                <ul className="aaa-panel-matches" role="list">
                  {brief.resolvedMatches.map((match) => (
                    <li key={match.recordId}>
                      {match.alanNumber ?? match.title} - marked {match.resolution}, surfaced
                      as {match.classification}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {reviewFlags.length > 0 ? (
              <section aria-labelledby="panel-flags">
                <h3 id="panel-flags" className="aaa-panel-section-heading">
                  Flagged for compliance review
                </h3>
                <ul className="aaa-panel-matches" role="list">
                  {reviewFlags.map((flag) => (
                    <li key={flag.id}>{flag.message}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {showFull ? (
              <section aria-labelledby="panel-full">
                <h3 id="panel-full" className="aaa-panel-section-heading">
                  The full brief
                </h3>
                <dl className="aaa-panel-list">
                  {grouped.map((group) =>
                    group.fields.map((field) => (
                      <div key={field.name}>
                        <dt>{field.label}</dt>
                        <dd>{brief.a3[field.name]}</dd>
                      </div>
                    )),
                  )}
                </dl>
                <button
                  type="button"
                  className="aaa-btn-text"
                  onClick={() => setShowFull(false)}
                >
                  Hide the full brief
                </button>
              </section>
            ) : (
              <button
                type="button"
                className="aaa-btn-text"
                onClick={() => setShowFull(true)}
              >
                Show the full brief
              </button>
            )}
          </div>
        ) : (
          <div id="panel-payload" role="tabpanel" aria-labelledby="tab-payload">
            <p className="aaa-panel-reason">
              This is exactly what would be posted to Workfront, with the internal field names it
              expects. Local reviewer Status and Priority are not included. It has not been posted.
            </p>
            <pre className="aaa-panel-payload" tabIndex={0} aria-label="The Workfront payload">
              {JSON.stringify(payload, null, 2)}
            </pre>

            {row.blockers.length > 0 ? (
              <section aria-labelledby="panel-blockers">
                <h3 id="panel-blockers" className="aaa-panel-section-heading">
                  Why it has not been sent
                </h3>
                <ul className="aaa-panel-matches" role="list">
                  {row.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
