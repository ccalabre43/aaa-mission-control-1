/**
 * Success dialog after a live dual-write returns a real Workfront Task ID.
 * Layout from assets/mocks/sent-to-workfront-modal.png (Figma AAA Life proto).
 */
import { useEffect, useRef } from "react";

export interface WorkfrontSentDialogProps {
  /** Workfront Task ID (stored on the brief as `workfront.issueId`). */
  issueId: string;
  issueUrl?: string;
  /** Queue topic name used for the route line (e.g. Corporate Communications). */
  topicName: string;
  /** Documents attached to Task Documents and the project Tasks folder. */
  uploadedDocuments?: Array<{ name: string; taskDocumentId?: string }>;
  /** Non-fatal upload issue after Task create. */
  documentError?: string;
  onClose: () => void;
  onViewQueue: () => void;
}

export function WorkfrontSentDialog({
  issueId,
  issueUrl,
  topicName,
  uploadedDocuments,
  documentError,
  onClose,
  onViewQueue,
}: WorkfrontSentDialogProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const routeLine = topicName.trim()
    ? `Routed to ${topicName.trim()}.`
    : "Routed on mission-control-v1.";

  const docCount = uploadedDocuments?.length ?? 0;
  const docLine =
    docCount > 0
      ? `${docCount} document${docCount === 1 ? "" : "s"} attached to the Task Documents tab and the project Tasks folder.`
      : null;

  return (
    <div
      className="aaa-modal-scrim aaa-sent-dialog-scrim"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="aaa-modal aaa-sent-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workfront-sent-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aaa-sent-dialog-body">
          <div className="aaa-sent-dialog-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5 10 17.5 19 7.5"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2
            id="workfront-sent-heading"
            className="aaa-sent-dialog-heading"
            tabIndex={-1}
            ref={headingRef}
          >
            Sent to Workfront
          </h2>
          <p className="aaa-sent-dialog-copy">
            {routeLine} Task {issueId} is on mission-control-v1 for kickoff.
          </p>
          {docLine ? <p className="aaa-sent-dialog-copy">{docLine}</p> : null}
          {docCount > 0 ? (
            <ul className="aaa-sent-dialog-docs">
              {uploadedDocuments!.map((doc) => (
                <li key={`${doc.name}-${doc.taskDocumentId ?? "name"}`}>
                  {doc.name}
                </li>
              ))}
            </ul>
          ) : null}
          {documentError ? (
            <p className="aaa-sent-dialog-copy aaa-sent-dialog-doc-error" role="status">
              Document upload issue: {documentError}
            </p>
          ) : null}
          {issueUrl ? (
            <p className="aaa-sent-dialog-link">
              <a href={issueUrl} target="_blank" rel="noopener noreferrer">
                Open in Workfront
              </a>
            </p>
          ) : null}
        </div>
        <div className="aaa-sent-dialog-foot">
          <button type="button" className="aaa-sent-dialog-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="aaa-sent-dialog-btn-primary" onClick={onViewQueue}>
            View in Reviewer Queue
          </button>
        </div>
      </div>
    </div>
  );
}
