/**
 * Full-page request summary (mock: assets/mocks/request-summary-page.png).
 *
 * Summary tab shows the reviewer layout; Workfront payload tab keeps the A3 payload and blockers.
 * Submit to Workfront Que dual-writes only when the proxy kill switch is on and the user confirms.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { WorkfrontSentDialog } from "../components/queue/WorkfrontSentDialog";
import { loadBriefs, upsertBrief } from "../lib/intake/storage";
import {
  REVIEWER_ASSESSMENT_LEVELS,
  REVIEWER_PRIORITIES,
  assessmentLabel,
  identityFullName,
  reviewerStatusLabel,
  type IntakeBrief,
  type ReviewerAssessmentLevel,
  type ReviewerPriority,
  type ReviewerStatus,
} from "../lib/intake/types";
import { loadQueueConfig } from "../lib/workfront/queueConfig";
import {
  fetchWorkfrontHealth,
  type WorkfrontProxyHealth,
} from "../lib/workfront/proxyHealth";
import {
  formatQueueDate,
  parseChannels,
  toQueueRow,
  type Viewer,
} from "../lib/workfront/queueList";
import {
  buildWorkfrontPayload,
  submitToWorkfront,
  workfrontSentDisplay,
} from "../lib/workfront/submitToWorkfront";
import { routeExplanation, routeFor } from "../lib/workfront/routing";
import {
  getWorkfrontUserAuth,
  hasWorkfrontUserBearer,
} from "../lib/workfront/userBearer";

interface SentDialogState {
  issueId: string;
  issueUrl?: string;
  topicName: string;
}

type PageTab = "summary" | "payload";

function displayOrDash(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed || "—";
}

function cyclePriority(current: ReviewerPriority): ReviewerPriority {
  const index = REVIEWER_PRIORITIES.indexOf(current);
  return REVIEWER_PRIORITIES[(index + 1) % REVIEWER_PRIORITIES.length] ?? "P2";
}

export default function RequestSummaryView() {
  const { briefId = "" } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const [queueConfig] = useState(() => loadQueueConfig().config);
  const [brief, setBrief] = useState<IntakeBrief | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<PageTab>("summary");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<WorkfrontProxyHealth | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentDialog, setSentDialog] = useState<SentDialogState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkfrontHealth(controller.signal).then(setHealth);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const found = loadBriefs().briefs.find((item) => item.id === briefId) ?? null;
    if (!found) {
      setMissing(true);
      setBrief(null);
      return;
    }
    setMissing(false);
    if (!found.reviewer.firstReviewedAt) {
      const next: IntakeBrief = {
        ...found,
        updatedAt: new Date().toISOString(),
        reviewer: {
          ...found.reviewer,
          firstReviewedAt: new Date().toISOString(),
        },
      };
      const saved = upsertBrief(next);
      if (saved.ok) {
        setBrief(next);
        return;
      }
    }
    setBrief(found);
  }, [briefId]);

  const viewer: Viewer = useMemo(
    () =>
      brief
        ? {
            firstName: brief.identity.firstName,
            lastName: brief.identity.lastName,
            email: brief.identity.email,
          }
        : { firstName: "", lastName: "", email: "" },
    [brief],
  );

  const row = useMemo(
    () => (brief ? toQueueRow(brief, queueConfig, viewer) : null),
    [brief, queueConfig, viewer],
  );

  const payload = useMemo(
    () => (brief ? buildWorkfrontPayload(brief, queueConfig) : null),
    [brief, queueConfig],
  );

  const route = useMemo(
    () => (brief ? routeFor(queueConfig, brief) : null),
    [brief, queueConfig],
  );

  function persist(next: IntakeBrief, message: string) {
    const saved = upsertBrief(next);
    if (!saved.ok) {
      setError(saved.reason ?? "That request could not be saved to this browser.");
      setStatusMessage("");
      return;
    }
    setBrief(next);
    setError("");
    setStatusMessage(message);
  }

  function patchReviewer(
    patch: Partial<IntakeBrief["reviewer"]>,
    message: string,
  ) {
    if (!brief) return;
    const next: IntakeBrief = {
      ...brief,
      updatedAt: new Date().toISOString(),
      reviewer: {
        ...brief.reviewer,
        ...patch,
        firstReviewedAt: brief.reviewer.firstReviewedAt ?? new Date().toISOString(),
      },
    };
    persist(next, message);
  }

  function setStatus(status: ReviewerStatus, message: string) {
    patchReviewer({ status }, message);
  }

  async function submitToWorkfrontQueue() {
    if (!brief || submitting) return;

    const alreadySent =
      brief.workfront?.mode === "workfront" && brief.workfront.issueId;
    if (alreadySent) {
      setStatusMessage(
        `Already linked to Workfront Task ${brief.workfront?.issueId}.`,
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
      const confirmed = window.confirm(
        [
          "Create this request as a Workfront Task on mission-control-v1?",
          "",
          ...enteredByLines,
          "",
          "Attachments are names only until a document upload path exists.",
        ].join("\n"),
      );
      if (!confirmed) {
        setStatusMessage("Live send cancelled. Nothing was posted to Workfront.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await submitToWorkfront(brief, queueConfig, {
        live: wantLive,
        confirmLive: wantLive ? true : undefined,
      });
      if (!result.ok) {
        setError(
          `Cannot submit yet. Still needed: ${result.missingFields.join(", ")}.`,
        );
        setStatusMessage("");
        return;
      }
      const submittedAt = new Date().toISOString();
      const next: IntakeBrief = {
        ...brief,
        status: "submitted",
        submittedAt: brief.submittedAt ?? submittedAt,
        updatedAt: submittedAt,
        workfront: {
          mode: result.mode,
          issueName: result.issueName,
          submittedAt,
          ...(result.issueId ? { issueId: result.issueId } : {}),
          ...(result.issueUrl ? { issueUrl: result.issueUrl } : {}),
        },
      };
      const saved = upsertBrief(next);
      if (!saved.ok) {
        setError(saved.reason ?? "That request could not be saved to this browser.");
        return;
      }
      setBrief(next);
      setError("");
      if (result.mode === "workfront" && result.issueId) {
        const routed = routeFor(queueConfig, next);
        setSentDialog({
          issueId: result.issueId,
          issueUrl: result.issueUrl,
          topicName: routed.topic?.name ?? "",
        });
        setStatusMessage(
          `"${result.issueName}" created in Workfront as Task ${result.issueId}. Saved in this browser with that ID.`,
        );
      } else if (wantLive && result.liveError) {
        setStatusMessage(
          `"${result.issueName}" is ready locally. Live send failed: ${result.liveError}`,
        );
      } else if (!wantLive) {
        const hint = health?.connected
          ? " Proxy is connected but live submit is off (WORKFRONT_LIVE_SUBMIT)."
          : " Workfront proxy is not connected.";
        setStatusMessage(
          `"${result.issueName}" is ready locally. It has not been sent to Workfront.${hint}`,
        );
      } else {
        setStatusMessage(
          `"${result.issueName}" is ready locally. It has not been sent to Workfront.`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (missing) {
    return (
      <main id="main" className="aaa-summary-page mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link to="/deliverables" className="aaa-summary-back">
          ← Back to request queue
        </Link>
        <h1 className="aaa-summary-title">Request not found</h1>
        <p className="aaa-summary-meta">
          That request is not saved in this browser.{" "}
          <Link to="/deliverables">Return to the request queue</Link>.
        </p>
      </main>
    );
  }

  if (!brief || !row || !payload || !route) {
    return (
      <main id="main" className="aaa-summary-page mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="aaa-summary-meta">Loading request…</p>
      </main>
    );
  }

  const channels = parseChannels(brief.a3.A3IntakeDeliverables);
  const timingParts = [
    brief.a3.A3IntakeTimingNotes?.trim(),
    brief.a3.A3IntakeDesiredCompletionDate?.trim()
      ? `Desired completion: ${brief.a3.A3IntakeDesiredCompletionDate.trim()}`
      : "",
  ].filter(Boolean);
  const reviewFlags = brief.complianceFlags.filter((flag) => flag.severity === "review");
  const approvals =
    reviewFlags.length > 0
      ? `Compliance review flagged: ${reviewFlags.map((flag) => flag.message).join("; ")}`
      : "Not specified in intake";
  const complianceNeedsReview = reviewFlags.length > 0 ? "Yes" : "No";
  const submittedLabel = formatQueueDate(brief.submittedAt ?? brief.createdAt);
  const requestor = identityFullName(brief.identity) || "Unknown requestor";
  const sentDisplay = workfrontSentDisplay(brief.workfront);

  const fieldsLeft: { label: string; value: string }[] = [
    { label: "Business context", value: displayOrDash(brief.a3.A3IntakeBackgroundPurpose) },
    { label: "Timing", value: timingParts.length ? timingParts.join(" ") : "—" },
    { label: "Approvals", value: approvals },
    {
      label: "Channels / deliverable",
      value: channels.length ? channels.join(", ") : displayOrDash(brief.a3.A3IntakeDeliverables),
    },
    {
      label: "What can we build from?",
      value: displayOrDash(brief.a3.A3IntakeAdditionalInformation),
    },
    {
      label: "Any brand requirements?",
      value: displayOrDash(brief.a3.A3IntakeGoalsExpectations),
    },
  ];

  const fieldsRight: { label: string; value: string }[] = [
    {
      label: "Audience",
      value: displayOrDash(brief.a3.A3IntakeSupplementalDescription),
    },
    {
      label: "Success metric",
      value: displayOrDash(brief.a3.A3IntakeSuccessMeasurement),
    },
    { label: "Compliance needs to review", value: complianceNeedsReview },
    {
      label: "What's the key message?",
      value: displayOrDash(brief.a3.A3IntakeProjectSummary),
    },
    {
      label: "What support do you need?",
      value: "—",
    },
  ];

  return (
    <main id="main" className="aaa-summary-page mx-auto max-w-5xl px-4 py-6 sm:px-6 pb-28">
      <Link to="/deliverables" className="aaa-summary-back">
        ← Back to request queue
      </Link>

      <div className="aaa-summary-chrome">
        <div className="aaa-summary-badges">
          <span className="aaa-summary-priority">{brief.reviewer.priority}</span>
          <span className="aaa-summary-status">
            <span
              className={`aaa-queue-status-dot status-${brief.reviewer.status}`}
              aria-hidden="true"
            />
            {reviewerStatusLabel(brief.reviewer.status)}
          </span>
        </div>
        <h1 className="aaa-summary-title">{row.name}</h1>
        <p className="aaa-summary-meta">
          {requestor} · submitted {submittedLabel || "—"}
          {channels.length ? ` · ${channels.join(", ")}` : ""}
        </p>
      </div>

      <div className="aaa-panel-tabs aaa-summary-tabs" role="tablist" aria-label="Request views">
        <button
          type="button"
          role="tab"
          id="summary-tab-summary"
          aria-selected={tab === "summary"}
          aria-controls="summary-panel-summary"
          className={tab === "summary" ? "aaa-panel-tab is-active" : "aaa-panel-tab"}
          onClick={() => setTab("summary")}
        >
          Summary
        </button>
        <button
          type="button"
          role="tab"
          id="summary-tab-payload"
          aria-selected={tab === "payload"}
          aria-controls="summary-panel-payload"
          className={tab === "payload" ? "aaa-panel-tab is-active" : "aaa-panel-tab"}
          onClick={() => setTab("payload")}
        >
          Workfront payload
        </button>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {statusMessage}
        {error}
      </div>
      {error ? (
        <div role="alert" className="aaa-flow-alert">
          {error}
        </div>
      ) : null}
      {statusMessage && !error ? <p className="aaa-page-status">{statusMessage}</p> : null}

      {tab === "summary" ? (
        <div
          id="summary-panel-summary"
          role="tabpanel"
          aria-labelledby="summary-tab-summary"
        >
          <div className="aaa-summary-card">
            <div className="aaa-summary-columns">
              <dl className="aaa-summary-fields">
                {fieldsLeft.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
              <dl className="aaa-summary-fields">
                {fieldsRight.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="aaa-summary-assessments" role="group" aria-label="Assessment">
            {(
              [
                ["impact", "Impact"],
                ["effort", "Effort"],
                ["risk", "Risk"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="aaa-summary-assessment">
                <span className="aaa-summary-assessment-label">{label}</span>
                <select
                  value={brief.reviewer[key]}
                  onChange={(event) =>
                    patchReviewer(
                      { [key]: event.target.value as ReviewerAssessmentLevel },
                      `${label} set to ${assessmentLabel(event.target.value as ReviewerAssessmentLevel)}.`,
                    )
                  }
                  aria-label={label}
                >
                  {REVIEWER_ASSESSMENT_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div
          id="summary-panel-payload"
          role="tabpanel"
          aria-labelledby="summary-tab-payload"
          className="aaa-summary-payload"
        >
          <p className="aaa-panel-reason">
            This is the A3 / Workfront Task payload. Local reviewer Status, Priority, and Impact /
            Effort / Risk are not included.
            {sentDisplay.sent
              ? ` Linked Workfront Task: ${brief.workfront?.issueId}.`
              : " It has not been posted until Submit to Workfront Que succeeds with a Task ID."}
          </p>
          <dl className="aaa-panel-list aaa-summary-payload-meta">
            <div>
              <dt>Path</dt>
              <dd>
                {row.path}
                <span className="aaa-panel-reason">{routeExplanation(route)}</span>
              </dd>
            </div>
            <div>
              <dt>Sent to Workfront</dt>
              <dd>
                {sentDisplay.label}
                {brief.workfront?.issueUrl ? (
                  <>
                    {" "}
                    <a
                      href={brief.workfront.issueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Workfront
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
          </dl>
          <pre className="aaa-panel-payload" tabIndex={0} aria-label="The Workfront payload">
            {JSON.stringify(payload, null, 2)}
          </pre>
          {!sentDisplay.sent && row.blockers.length > 0 ? (
            <section aria-labelledby="summary-blockers">
              <h2 id="summary-blockers" className="aaa-panel-section-heading">
                Why it has not been sent
              </h2>
              <ul className="aaa-panel-matches" role="list">
                {row.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
                {!health?.liveSubmit ? (
                  <li>
                    Live submit kill switch is off. Set WORKFRONT_LIVE_SUBMIT=1 on the proxy
                    to allow dual-write after confirmation.
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <div className="aaa-summary-actions" role="group" aria-label="Reviewer actions">
        <button
          type="button"
          className="aaa-summary-btn aaa-summary-btn-primary"
          onClick={() => setStatus("approved", "Marked Accepted (Approved — transfer).")}
        >
          Accept
        </button>
        <button
          type="button"
          className="aaa-summary-btn aaa-summary-btn-secondary"
          onClick={() => submitToWorkfrontQueue()}
          disabled={submitting}
        >
          {submitting
            ? "Submitting…"
            : sentDisplay.sent
              ? "Already in Workfront"
              : "Submit to Workfront Que"}
        </button>
        <button
          type="button"
          className="aaa-summary-btn aaa-summary-btn-ghost"
          onClick={() => {
            const next = cyclePriority(brief.reviewer.priority);
            patchReviewer({ priority: next }, `Priority overridden to ${next}.`);
          }}
        >
          Override priority
        </button>
        <button
          type="button"
          className="aaa-summary-btn aaa-summary-btn-ghost"
          onClick={() =>
            setStatus("needs_clarification", "Returned for clarification.")
          }
        >
          Return for clarification
        </button>
        <button
          type="button"
          className="aaa-summary-btn aaa-summary-btn-ghost"
          onClick={() => setStatus("deferred", "Deferred to backlog.")}
        >
          Defer
        </button>
        <button
          type="button"
          className="aaa-summary-btn aaa-summary-btn-danger-text"
          onClick={() => setStatus("escalated", "Escalated.")}
        >
          Escalate
        </button>
      </div>

      {sentDialog ? (
        <WorkfrontSentDialog
          issueId={sentDialog.issueId}
          issueUrl={sentDialog.issueUrl}
          topicName={sentDialog.topicName}
          onClose={() => setSentDialog(null)}
          onViewQueue={() => {
            setSentDialog(null);
            navigate("/deliverables");
          }}
        />
      ) : null}
    </main>
  );
}
