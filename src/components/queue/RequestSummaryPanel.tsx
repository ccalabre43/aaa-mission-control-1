/**
 * The right-hand Summary panel Workfront opens for a selected request.
 *
 * Two modes, and the restricted one is the default posture rather than an afterthought:
 *
 * - **Summary only** shows ALAN number, request name, requesting team, status, path, and the match
 *   reasons. Guardrail 6 limits any cross-team listing to exactly that, and this panel becomes
 *   cross-team the moment the corpus comes from Workfront rather than from one browser.
 * - **Full** adds the assembled A3 fields, read-only, in Workfront's own section order.
 *
 * The requester's email is in neither mode. Name and department are the most that ever appears here,
 * because an email in a queue listing is PII leaving its original context.
 *
 * Rendered as a dialog rather than an expanding row: the panel is long enough that expanding a row
 * in place pushes the rest of the table off screen, and a dialog gives focus somewhere to return to.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { groupA3BySection } from "../../lib/intake/a3Schema";
import { briefStatusLabel, type IntakeBrief } from "../../lib/intake/types";
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
}

type PanelTab = "summary" | "payload";

export function RequestSummaryPanel({
  brief,
  row,
  queueConfig,
  onClose,
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

  // 2.4.3 Focus Order: focus moves into the panel on open, and Escape closes it (a dialog that
  // traps a keyboard user is worse than no dialog).
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

        {/*
          Tabs, not two screens: the payload is the same request in Workfront's own words, and moving
          between them should not lose the reader's place.
        */}
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
            <dl className="aaa-panel-list">
              <div>
                <dt>ALAN number</dt>
                <dd>{brief.alanNumber ?? "None yet - new piece"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{briefStatusLabel(brief.status)}</dd>
              </div>
              <div>
                <dt>Sent to Workfront</dt>
                {/* Just "No". The label already says what the answer is about, and repeating it
                    read as a stray debug string in the rendered panel. */}
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
                <dt>Requesting team</dt>
                {/* Name and department. Never the email. */}
                <dd>{row.requesterLabel}</dd>
              </div>
              <div>
                <dt>Duplicate check</dt>
                {/* Coverage-qualified, so an empty result is never read as an all-clear. */}
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
                      {/* Summary only: identifier, title, and why it surfaced. No brief body. */}
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

            {/*
              The brief body is behind a deliberate action, not a default. Once the corpus is
              Workfront-backed this panel shows other teams' requests, and guardrail 6 allows a
              summary in that listing but never the body.
            */}
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
              expects. It has not been posted. Blank Workfront IDs are the reason.
            </p>
            {/*
              Shown as JSON on purpose. The point of this view is that the request is complete and
              inspectable rather than mysterious, and a prettified version would hide which internal
              field names are actually being sent.
            */}
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
