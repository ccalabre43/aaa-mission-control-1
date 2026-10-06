/**
 * Step 4, Related activity: the human-in-the-loop checkpoint before a draft is assembled.
 *
 * This step never blocks. It surfaces what the matcher found, lets the requester say what each
 * match actually is, and continues either way. A requester is better placed than a keyword matcher
 * to know whether two pieces of work are the same thing.
 *
 * Critically, this screen is NOT an all-clear. When nothing matched it says what was searched, with
 * neutral styling and no checkmark, because presenting an empty local search as an
 * organization-wide green light is exactly the overclaim the guardrails forbid.
 */
import type { RefObject } from "react";
import { RelatedWorkPanel } from "../../components/RelatedWorkPanel";
import type { ComplianceFlag } from "../../lib/intake/types";
import type { MatchOutcome, MatchResolution } from "../../lib/related/types";

interface RelatedStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  outcome: MatchOutcome | null;
  matching: boolean;
  resolutions: Record<string, MatchResolution>;
  complianceFlags: ComplianceFlag[];
  onResolve: (recordId: string, resolution: MatchResolution) => void;
  onAcknowledgeFlag: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function RelatedStep({
  headingRef,
  outcome,
  matching,
  resolutions,
  complianceFlags,
  onResolve,
  onAcknowledgeFlag,
  onBack,
  onNext,
}: RelatedStepProps) {
  const duplicates = Object.values(resolutions).filter(
    (resolution) => resolution === "duplicate",
  ).length;
  const openFlags = complianceFlags.filter(
    (flag) => flag.severity === "review" && !flag.acknowledged,
  );

  return (
    <div className="aaa-flow-panel">
      <p className="aaa-step-label">
        Step 4 <span aria-hidden="true">&middot;</span> Related activity
      </p>

      <h1 className="aaa-flow-heading-left" tabIndex={-1} ref={headingRef}>
        Before we draft this, is any of it already happening?
      </h1>
      <p className="aaa-flow-sub-left">
        Tell us what these are and the answers travel with your brief. Nothing here stops you
        from continuing.
      </p>

      <RelatedWorkPanel
        outcome={outcome}
        busy={matching}
        resolutions={resolutions}
        onResolve={onResolve}
      />

      {openFlags.length > 0 ? (
        <section className="aaa-flag-block" aria-labelledby="flags-heading">
          <h2 id="flags-heading" className="aaa-flag-heading">
            Worth a compliance look
          </h2>
          <p className="aaa-flag-intro">
            Based on the wording you used. These do not stop your request, and they travel with
            it so a reviewer sees them.
          </p>
          <ul role="list" className="aaa-flag-list">
            {openFlags.map((flag) => (
              <li key={flag.id} className="aaa-flag">
                <p>{flag.message}</p>
                <button
                  type="button"
                  className="aaa-btn-text"
                  onClick={() => onAcknowledgeFlag(flag.id)}
                >
                  Got it
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {duplicates > 0 ? (
        <p className="aaa-related-note" role="status">
          You marked {duplicates}{" "}
          {duplicates === 1 ? "item as the same work" : "items as the same work"}. Your
          request will still be created, with that noted for the reviewer.
        </p>
      ) : null}

      <div className="aaa-flow-actions">
        {/* Back goes to the LAST question, per the flow diagram, not the first. */}
        <button type="button" className="aaa-btn-text" onClick={onBack}>
          Back to last question
        </button>
        <button type="button" className="aaa-btn aaa-btn-primary" onClick={onNext}>
          Draft my brief
        </button>
      </div>
    </div>
  );
}
