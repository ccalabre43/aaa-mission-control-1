/**
 * Surfaces possible duplicate and related work.
 *
 * Two guardrails shape this component:
 *
 * 1. **Summary only.** A card shows ALAN number, title, team, status, and the reason it matched -
 *    never a brief body, an attachment, or a requester's email. That is enforced upstream by
 *    `CorpusRecord` not carrying those fields, so this component cannot leak them even by mistake.
 *
 * 2. **A negative result is also a recommendation.** The empty state never says "no duplicates
 *    found". It renders from the `MatchCoverage` descriptor and states what was actually searched,
 *    because in this build that is one browser's storage - which a requester would otherwise read
 *    as an organization-wide all-clear.
 *
 * The coverage line is always visible, not only when empty. Today it reads as a caveat; once
 * Workfront is connected the same line simply becomes an accurate statement of scope.
 */
import {
  describeCoverage,
  describeCoverageForAnnouncement,
  describeEmptyResult,
} from "../lib/related/coverage";
import { MATCH_CLASSIFICATION_ORDER } from "../lib/related/types";
import type {
  MatchClassification,
  MatchOutcome,
  MatchResolution,
} from "../lib/related/types";

const CLASSIFICATION_COPY: Record<
  MatchClassification,
  { badge: string; heading: string; blurb: string }
> = {
  duplicate: {
    badge: "Possible duplicate",
    heading: "This may already be underway",
    blurb: "Worth a look before you continue - it may be the same piece of work.",
  },
  overlap: {
    badge: "Overlaps",
    heading: "Another team is working on something close to this",
    blurb: "Not necessarily a conflict, but worth knowing about.",
  },
  related: {
    badge: "Related",
    heading: "Related work",
    blurb: "Background that may be useful to whoever picks this up.",
  },
  opportunity: {
    badge: "Opportunity",
    heading: "A chance to combine work",
    blurb: "Similar timing or format, different subject. Sometimes worth doing together.",
  },
};

interface RelatedWorkPanelProps {
  outcome: MatchOutcome | null;
  /** True while a search is in flight. */
  busy?: boolean;
  /** Compact form for the sidebar shown during the guided questions. */
  compact?: boolean;
  /** Present only on the Related activity step, where matches can be resolved. */
  resolutions?: Record<string, MatchResolution>;
  onResolve?: (recordId: string, resolution: MatchResolution) => void;
}

export function RelatedWorkPanel({
  outcome,
  busy = false,
  compact = false,
  resolutions,
  onResolve,
}: RelatedWorkPanelProps) {
  if (!outcome) {
    return (
      <section
        className={compact ? "aaa-related aaa-related-compact" : "aaa-related"}
        aria-labelledby="related-heading"
      >
        <h2 id="related-heading" className="aaa-related-heading">
          Related activity
        </h2>
        <p className="aaa-related-empty">
          {busy ? "Checking for related work..." : describeCoverage(null)}
        </p>
      </section>
    );
  }

  const { matches, coverage } = outcome;
  const grouped = MATCH_CLASSIFICATION_ORDER.map((classification) => ({
    classification,
    items: matches.filter((match) => match.classification === classification),
  })).filter((group) => group.items.length > 0);

  return (
    <section
      className={compact ? "aaa-related aaa-related-compact" : "aaa-related"}
      aria-labelledby="related-heading"
    >
      <h2 id="related-heading" className="aaa-related-heading">
        Related activity
        {matches.length > 0 ? (
          <span className="aaa-related-count">{matches.length}</span>
        ) : null}
      </h2>

      {/*
        Polite and qualified. It announces the scope alongside the count, so a screen reader user
        is not told "no matches" without also being told how little was searched (4.1.3).
      */}
      <div className="sr-only" role="status" aria-live="polite">
        {busy ? "" : describeCoverageForAnnouncement(matches.length, coverage)}
      </div>

      {matches.length === 0 ? (
        /* Neutral, never a green check: an empty result is information, not a clearance. */
        <p className="aaa-related-empty">{describeEmptyResult(coverage)}</p>
      ) : (
        <div className="aaa-related-groups">
          {grouped.map((group) => {
            const copy = CLASSIFICATION_COPY[group.classification];
            return (
              <div key={group.classification} className="aaa-related-group">
                <h3 className="aaa-related-group-heading">
                  {compact ? copy.badge : copy.heading}
                </h3>
                {!compact ? (
                  <p className="aaa-related-group-blurb">{copy.blurb}</p>
                ) : null}

                <ul role="list" className="aaa-related-list">
                  {group.items.map((match) => {
                    const resolution = resolutions?.[match.record.id];
                    return (
                      <li key={match.record.id} className="aaa-related-card">
                        <p className="aaa-related-card-top">
                          <span
                            className={`aaa-badge aaa-badge-${group.classification}`}
                          >
                            {copy.badge}
                          </span>
                          {match.record.alanNumber ? (
                            <span className="aaa-related-alan">
                              {match.record.alanNumber}
                            </span>
                          ) : null}
                        </p>

                        <p className="aaa-related-title">{match.record.title}</p>

                        <p className="aaa-related-meta">
                          {match.record.team ? `${match.record.team} - ` : ""}
                          {match.record.status}
                          {match.record.deadline
                            ? ` - due ${match.record.deadline}`
                            : ""}
                        </p>

                        {/* Every match states its signal. No unexplained scoring. */}
                        <ul role="list" className="aaa-related-reasons">
                          {match.reasons.slice(0, 3).map((reason) => (
                            <li key={reason.signal}>{reason.text}</li>
                          ))}
                        </ul>

                        {onResolve ? (
                          <div className="aaa-related-actions">
                            {(
                              [
                                ["duplicate", "Same work"],
                                ["related", "Related"],
                                ["not-a-match", "Not a match"],
                              ] as Array<[MatchResolution, string]>
                            ).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={
                                  resolution === value
                                    ? "aaa-chip aaa-chip-selected"
                                    : "aaa-chip"
                                }
                                aria-pressed={resolution === value}
                                onClick={() => onResolve(match.record.id, value)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Always visible, empty or not. See the note at the top of this file. */}
      <p className="aaa-related-coverage">{describeCoverage(coverage)}</p>
    </section>
  );
}
