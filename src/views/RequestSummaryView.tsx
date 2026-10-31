/**
 * Full-page request summary (mock: assets/mocks/request-summary-page.png).
 * Concept v1 Figma node 369-5482: Size + Impact + Effort + Risk; Accept — Send to Workfront.
 *
 * Summary tab shows the reviewer layout; Workfront payload tab keeps the A3 payload and blockers.
 * Accept — Send dual-writes only when the proxy kill switch is on and the user confirms.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { WorkfrontSentDialog } from "../components/queue/WorkfrontSentDialog";
import sizeTshirtIcon from "../assets/summary-size-tshirt.png";
import {
  hasAttachmentFile,
  listAttachmentFiles,
  storeAttachmentFile,
  storeAttachmentFiles,
} from "../lib/intake/attachmentFileStore";
import { loadBriefs, upsertBrief } from "../lib/intake/storage";
import { buildSummaryBriefFields } from "../lib/intake/summaryBriefFields";
import {
  REVIEWER_ASSESSMENT_LEVELS,
  REVIEWER_PRIORITIES,
  REVIEWER_SIZES,
  assessmentLabel,
  identityFullName,
  reviewerStatusLabel,
  sizeLabel,
  type AttachmentRef,
  type IntakeBrief,
  type ReviewerAssessmentLevel,
  type ReviewerPriority,
  type ReviewerSize,
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
  uploadedDocuments?: Array<{ name: string; taskDocumentId?: string }>;
  documentError?: string;
}

type PageTab = "summary" | "payload";

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
  const [attachmentEpoch, setAttachmentEpoch] = useState(0);
  const reattachInputRef = useRef<HTMLInputElement | null>(null);
  const reattachTargetId = useRef<string | null>(null);

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

  /**
   * Concept v1 primary: mark Approved — transfer, then run the existing dual-write path.
   * Cancelled or failed send still keeps Accept; messaging stays honest about Workfront.
   */
  async function acceptAndSendToWorkfront() {
    if (!brief || submitting) return;

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
    setBrief(approved);
    setError("");

    const alreadySent =
      approved.workfront?.mode === "workfront" && approved.workfront.issueId;
    if (alreadySent) {
      setStatusMessage(
        `Marked Accepted (Approved — transfer). Already linked to Workfront Task ${approved.workfront?.issueId}.`,
      );
      return;
    }

    setStatusMessage("Marked Accepted (Approved — transfer).");
    await submitToWorkfrontQueue(approved);
  }

  async function submitToWorkfrontQueue(sourceBrief?: IntakeBrief) {
    const current = sourceBrief ?? brief;
    if (!current || submitting) return;

    const alreadySent =
      current.workfront?.mode === "workfront" && current.workfront.issueId;
    if (alreadySent) {
      setStatusMessage(
        `Already linked to Workfront Task ${current.workfront?.issueId}.`,
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
      const filesReady = listAttachmentFiles(current.id).length;
      const attachmentCount = current.attachments.length;
      const attachmentLine =
        attachmentCount === 0
          ? "No supporting files are attached."
          : filesReady === attachmentCount
            ? `${filesReady} supporting file${filesReady === 1 ? "" : "s"} will upload to the Task Documents tab and the project Tasks folder.`
            : `${filesReady} of ${attachmentCount} file${attachmentCount === 1 ? "" : "s"} ready in this browser session. Re-attach missing files below before sending, or names-only will be recorded.`;
      const confirmed = window.confirm(
        [
          "Create this request as a Workfront Task on mission-control-v1?",
          "",
          ...enteredByLines,
          "",
          attachmentLine,
        ].join("\n"),
      );
      if (!confirmed) {
        setStatusMessage(
          current.reviewer.status === "approved"
            ? "Marked Accepted (Approved — transfer). Live send cancelled. Nothing was posted to Workfront."
            : "Live send cancelled. Nothing was posted to Workfront.",
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await submitToWorkfront(current, queueConfig, {
        live: wantLive,
        confirmLive: wantLive ? true : undefined,
        attachmentFiles: listAttachmentFiles(current.id),
      });
      if (!result.ok) {
        setError(
          `Cannot submit yet. Still needed: ${result.missingFields.join(", ")}.`,
        );
        setStatusMessage(
          current.reviewer.status === "approved"
            ? "Marked Accepted (Approved — transfer). Workfront send did not complete."
            : "",
        );
        return;
      }
      const submittedAt = new Date().toISOString();
      const next: IntakeBrief = {
        ...current,
        status: "submitted",
        submittedAt: current.submittedAt ?? submittedAt,
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
          uploadedDocuments: result.uploadedDocuments,
          documentError: result.documentError,
        });
        const docNote = result.uploadedDocuments?.length
          ? ` Uploaded ${result.uploadedDocuments.length} document${result.uploadedDocuments.length === 1 ? "" : "s"} to Task Documents and the project Tasks folder.`
          : result.documentError
            ? ` Document upload issue: ${result.documentError}`
            : "";
        setStatusMessage(
          `Marked Accepted. "${result.issueName}" created in Workfront as Task ${result.issueId}. Saved in this browser with that ID.${docNote}`,
        );
      } else if (wantLive && result.liveError) {
        setStatusMessage(
          `Marked Accepted. "${result.issueName}" is ready locally. Live send failed: ${result.liveError}`,
        );
      } else if (!wantLive) {
        const hint = health?.connected
          ? " Proxy is connected but live submit is off (WORKFRONT_LIVE_SUBMIT)."
          : " Workfront proxy is not connected.";
        setStatusMessage(
          `Marked Accepted. "${result.issueName}" is ready locally. It has not been sent to Workfront.${hint}`,
        );
      } else {
        setStatusMessage(
          `Marked Accepted. "${result.issueName}" is ready locally. It has not been sent to Workfront.`,
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

  const { left: fieldsLeft, right: fieldsRight } = buildSummaryBriefFields(brief);
  const channels = parseChannels(
    brief.a3.A3IntakeDeliverables?.trim() || brief.answers["q-deliverables"],
  );
  const submittedLabel = formatQueueDate(brief.submittedAt ?? brief.createdAt);
  const requestor = identityFullName(brief.identity) || "Unknown requestor";
  const sentDisplay = workfrontSentDisplay(brief.workfront);

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

          <section
              className="aaa-summary-card aaa-summary-attachments"
              aria-labelledby="summary-attachments-heading"
            >
              <h2 id="summary-attachments-heading" className="aaa-panel-section-heading">
                Supporting files for Workfront
              </h2>
              <p className="aaa-panel-reason">
                Files stay in this browser session until submit. If you reloaded the page,
                re-attach each file so Workfront receives the original document.
              </p>
              {brief.attachments.length === 0 ? (
                <p className="aaa-field-hint">No files were attached during intake.</p>
              ) : (
                <ul role="list" className="aaa-attachment-list">
                  {brief.attachments.map((attachment) => {
                    const ready = hasAttachmentFile(brief.id, attachment.id);
                    // Force re-read when epoch bumps after re-attach.
                    void attachmentEpoch;
                    return (
                      <li key={attachment.id} className="aaa-attachment">
                        <span
                          className={
                            ready
                              ? "aaa-attachment-ready is-ready"
                              : "aaa-attachment-ready"
                          }
                          aria-hidden="true"
                          title={ready ? "Ready to upload" : "Missing binary in this session"}
                        />
                        <span className="aaa-attachment-name">{attachment.fileName}</span>
                        <span className="aaa-attachment-size">
                          {ready ? "Ready to upload" : "Re-attach required"}
                        </span>
                        {!ready ? (
                          <button
                            type="button"
                            className="aaa-btn-text"
                            onClick={() => {
                              reattachTargetId.current = attachment.id;
                              reattachInputRef.current?.click();
                            }}
                          >
                            Attach file to upload
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <input
                ref={reattachInputRef}
                type="file"
                multiple
                className="sr-only"
                aria-label="Re-attach supporting files for Workfront upload"
                onChange={(event) => {
                  const chosen = Array.from(event.target.files ?? []);
                  if (!brief || chosen.length === 0) return;
                  const targetId = reattachTargetId.current;
                  if (targetId && chosen[0]) {
                    storeAttachmentFile(brief.id, targetId, chosen[0]);
                    reattachTargetId.current = null;
                    const remaining = chosen.slice(1);
                    if (remaining.length > 0) {
                      const missing = brief.attachments.filter(
                        (item) =>
                          item.id !== targetId && !hasAttachmentFile(brief.id, item.id),
                      );
                      storeAttachmentFiles(
                        brief.id,
                        remaining.map((file, index) => ({
                          attachmentId: missing[index]?.id ?? `extra-${crypto.randomUUID()}`,
                          file,
                        })),
                      );
                      if (remaining.length > missing.length) {
                        const extras: AttachmentRef[] = remaining
                          .slice(missing.length)
                          .map((file) => ({
                            id: crypto.randomUUID(),
                            fileName: file.name,
                            size: file.size,
                            mimeType: file.type,
                            addedAt: new Date().toISOString(),
                          }));
                        const withExtras: IntakeBrief = {
                          ...brief,
                          attachments: [...brief.attachments, ...extras],
                          updatedAt: new Date().toISOString(),
                        };
                        storeAttachmentFiles(
                          brief.id,
                          extras.map((ref, index) => ({
                            attachmentId: ref.id,
                            file: remaining[missing.length + index],
                          })),
                        );
                        persist(withExtras, `Attached ${chosen.length} file(s) for Workfront upload.`);
                        setAttachmentEpoch((value) => value + 1);
                        event.target.value = "";
                        return;
                      }
                    }
                  } else {
                    const missing = brief.attachments.filter(
                      (item) => !hasAttachmentFile(brief.id, item.id),
                    );
                    storeAttachmentFiles(
                      brief.id,
                      chosen.map((file, index) => ({
                        attachmentId: missing[index]?.id ?? `extra-${crypto.randomUUID()}`,
                        file,
                      })),
                    );
                  }
                  setAttachmentEpoch((value) => value + 1);
                  setStatusMessage(
                    `Attached ${chosen.length} file${chosen.length === 1 ? "" : "s"} for Workfront upload.`,
                  );
                  event.target.value = "";
                }}
              />
          </section>

          <div className="aaa-summary-assessments" role="group" aria-label="Assessment">
            <label className="aaa-summary-assessment aaa-summary-assessment-size">
              <img
                className="aaa-summary-size-shirt"
                src={sizeTshirtIcon}
                alt=""
                width={40}
                height={42}
                aria-hidden="true"
              />
              <span className="aaa-summary-size-text">
                <span className="aaa-summary-assessment-label">Size</span>
                <select
                  value={brief.reviewer.size}
                  onChange={(event) => {
                    const next = event.target.value as ReviewerSize;
                    patchReviewer(
                      { size: next },
                      `Size set to ${sizeLabel(next)}.`,
                    );
                  }}
                  aria-label="Size"
                >
                  {REVIEWER_SIZES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
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
            This is the A3 / Workfront Task payload. Local reviewer Status, Priority, Size, and
            Impact / Effort / Risk are not included.
            {sentDisplay.sent
              ? ` Linked Workfront Task: ${brief.workfront?.issueId}.`
              : " It has not been posted until Accept — Send to Workfront succeeds with a Task ID."}
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
          onClick={() => void acceptAndSendToWorkfront()}
          disabled={submitting}
        >
          {submitting ? "Sending…" : "Accept — Send to Workfront"}
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
          uploadedDocuments={sentDialog.uploadedDocuments}
          documentError={sentDialog.documentError}
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
