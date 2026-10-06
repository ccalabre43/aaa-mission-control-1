/**
 * Step 7, Confirmed.
 *
 * The Peak-End Rule earns this screen its own attention: the ending shapes how the whole flow is
 * remembered. So it confirms clearly, says exactly what happened, and offers the "Start another
 * request" edge from the flow diagram.
 *
 * It is careful not to overstate. The request has been saved to this device, NOT sent to Workfront,
 * and saying otherwise would be a lie the requester acts on - they would stop chasing it.
 */
import type { RefObject } from "react";
import { Link } from "react-router-dom";
import { describeCoverageForAudit } from "../../lib/related/coverage";
import { briefStatusLabel, type IntakeBrief } from "../../lib/intake/types";
import type { QueueDef } from "../../lib/workfront/queueConfig";
import { pathLabel, routeFor } from "../../lib/workfront/routing";

interface ConfirmedStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  brief: IntakeBrief;
  queueConfig: QueueDef;
  onStartAnother: () => void;
  onHome: () => void;
}

export default function ConfirmedStep({
  headingRef,
  brief,
  queueConfig,
  onStartAnother,
  onHome,
}: ConfirmedStepProps) {
  const flagged = brief.complianceFlags.filter((flag) => flag.severity === "review");
  const route = routeFor(queueConfig, brief);

  return (
    <div className="aaa-flow-centered">
      {/* Not a green check: this is a real state change, and the wording carries it. */}
      <h1 className="aaa-flow-heading" tabIndex={-1} ref={headingRef}>
        Your request is ready
      </h1>

      <p className="aaa-flow-sub" role="status">
        Saved to this device on{" "}
        {new Date(brief.submittedAt ?? Date.now()).toLocaleDateString()}.
      </p>

      <dl className="aaa-confirm-summary">
        <div>
          {/*
            "Request name", not "Reference". Workfront assigns a real reference number when an issue
            is created, and this value is the locally built issue name - the same string the queue
            shows in its Name column. Calling it a reference invited someone to quote it to Workfront
            support as though it were a Workfront identifier.
          */}
          <dt>Request name</dt>
          <dd>{brief.workfront?.issueName ?? "Not assigned"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{briefStatusLabel(brief.status)}</dd>
        </div>
        <div>
          <dt>Path</dt>
          <dd>{pathLabel(route)}</dd>
        </div>
        <div>
          <dt>ALAN number</dt>
          <dd>{brief.alanNumber ?? "None yet - new piece"}</dd>
        </div>
        <div>
          <dt>Requested by</dt>
          <dd>
            {brief.identity.firstName} {brief.identity.lastName},{" "}
            {brief.identity.department}
          </dd>
        </div>
        <div>
          <dt>Duplicate check</dt>
          {/* States what was actually searched, so the record is not read as an all-clear. */}
          <dd>{describeCoverageForAudit(brief.matchCoverage)}</dd>
        </div>
      </dl>

      {flagged.length > 0 ? (
        <p className="aaa-flow-footnote">
          {flagged.length}{" "}
          {flagged.length === 1 ? "item was flagged" : "items were flagged"} for compliance
          review. They travel with your brief.
        </p>
      ) : null}

      <div className="aaa-confirm-next">
        <p className="aaa-confirm-next-heading">What happens next</p>
        <p>
          This is saved in this browser. Sending it to the Workfront intake queue is not
          connected yet, so let your creative partner know it is ready.
        </p>
      </div>

      <div className="aaa-flow-actions aaa-flow-actions-center">
        <button type="button" className="aaa-btn-text" onClick={onHome}>
          Back to Mission Control
        </button>
        <button
          type="button"
          className="aaa-btn aaa-btn-primary"
          onClick={onStartAnother}
        >
          Start another request
        </button>
      </div>

      <p className="aaa-flow-footnote">
        <Link to="/deliverables" className="aaa-link-quiet">
          View the Request Queue
        </Link>
      </p>
    </div>
  );
}
