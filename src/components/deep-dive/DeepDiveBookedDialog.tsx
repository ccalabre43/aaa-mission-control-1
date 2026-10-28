/**
 * Success dialog after a local Deep Dive booking.
 * Mirrors WorkfrontSentDialog chrome; SharePoint link is external (leaves the app).
 */
import { useEffect, useRef } from "react";
import { DEEP_DIVE_SHAREPOINT_CALENDAR_URL } from "../../lib/meetings/constants";

export interface DeepDiveBookedDialogProps {
  /** Human summary, e.g. "Oct 28, 2026 · 1:15 – 1:30 PM". */
  whenSummary: string;
  topic?: string;
  audience?: string;
  onClose: () => void;
}

export function DeepDiveBookedDialog({
  whenSummary,
  topic,
  audience,
  onClose,
}: DeepDiveBookedDialogProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

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
        aria-labelledby="deep-dive-booked-heading"
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
            id="deep-dive-booked-heading"
            className="aaa-sent-dialog-heading"
            tabIndex={-1}
            ref={headingRef}
          >
            Deep Dive booked
          </h2>
          <p className="aaa-sent-dialog-copy">
            Your session is scheduled for <strong>{whenSummary}</strong>
            {topic?.trim() ? ` — ${topic.trim()}` : ""}
            {audience?.trim() ? ` · Audience: ${audience.trim()}` : ""}. This booking is
            saved on this device until live SharePoint write is approved.
          </p>
          <p className="aaa-sent-dialog-link">
            <a
              href={DEEP_DIVE_SHAREPOINT_CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Deep Dive calendar on SharePoint
            </a>
          </p>
          <p className="aaa-field-hint" style={{ marginTop: "0.75rem" }}>
            Opens SharePoint in a new tab. You will leave Mission Control.
          </p>
        </div>
        <div className="aaa-sent-dialog-foot">
          <button type="button" className="aaa-sent-dialog-btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
