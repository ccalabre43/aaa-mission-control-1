/**
 * Refresh-from-Workfront result dialog: Task inventory from mission-control-v1.
 * Layout from assets/mocks/workfront-refresh-modal.jpg (success title + centered Task blocks).
 */
import { useEffect, useRef } from "react";
import type { WorkfrontRemoteIssue } from "../../lib/workfront/proxyClient";

export interface WorkfrontRefreshDialogProps {
  issues: WorkfrontRemoteIssue[];
  /** Task ID → local brief id when linked. */
  linkedBriefIds: Record<string, string>;
  onOpenSummary: (briefId: string) => void;
  onClose: () => void;
}

function taskMetaLine(
  issue: WorkfrontRemoteIssue,
  linked: boolean,
): string {
  const parts: string[] = [];
  if (issue.status?.trim()) {
    parts.push(issue.status.trim());
  }
  if (issue.priority?.trim()) {
    const raw = issue.priority.trim();
    parts.push(/^priority\b/i.test(raw) ? raw : `Priority ${raw}`);
  }
  if (linked) {
    parts.push("linked to local brief");
  }
  return parts.join(", ");
}

export function WorkfrontRefreshDialog({
  issues,
  linkedBriefIds,
  onOpenSummary,
  onClose,
}: WorkfrontRefreshDialogProps) {
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
        className="aaa-modal aaa-sent-dialog aaa-refresh-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workfront-refresh-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aaa-sent-dialog-body aaa-refresh-dialog-body">
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
            id="workfront-refresh-heading"
            className="aaa-sent-dialog-heading"
            tabIndex={-1}
            ref={headingRef}
          >
            Refresh from Workfront: Complete
          </h2>
          <p className="aaa-refresh-dialog-section">
            Workfront Tasks (mission-control-v1)
          </p>
          {issues.length === 0 ? (
            <p className="aaa-sent-dialog-copy">
              No Tasks were returned from mission-control-v1.
            </p>
          ) : (
            <ul className="aaa-refresh-dialog-list" role="list">
              {issues.map((issue) => {
                const briefId = linkedBriefIds[issue.ID];
                const meta = taskMetaLine(issue, Boolean(briefId));
                return (
                  <li key={issue.ID} className="aaa-refresh-dialog-task">
                    <p className="aaa-refresh-dialog-task-title">
                      <strong>{issue.name || "(untitled)"}</strong>, {issue.ID}
                    </p>
                    {meta ? (
                      <p className="aaa-refresh-dialog-meta">{meta}</p>
                    ) : null}
                    {briefId ? (
                      <button
                        type="button"
                        className="aaa-refresh-dialog-link"
                        onClick={() => onOpenSummary(briefId)}
                      >
                        Open Linked Summary
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
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
