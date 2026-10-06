/**
 * Step 2, per assets/mocks/creative-request-context-interface.png: free text plus an attachment
 * dropzone.
 *
 * This is also the ONLY place an ALAN number is captured, per the requirement. It is deliberately
 * not a guided question, which keeps the guided set at nine as the mock draws it.
 *
 * The designed behavior is: a document is uploaded, its ALAN number is recognized and used; if none
 * is found, the app asks whether the requester has one. `NoopDetector` always reports nothing found,
 * so the ask branch always runs - meaning the shipped path IS the designed no-match path rather
 * than a stub around it.
 */
import { useRef, useState, type RefObject } from "react";
import { AlanCombobox } from "../../components/AlanCombobox";
import type { AttachmentRef } from "../../lib/intake/types";

interface ContextStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  contextText: string;
  attachments: AttachmentRef[];
  alanValue: string;
  /** True once detection has run, which is what reveals the ALAN question. */
  alanPrompted: boolean;
  detectionNote: string | null;
  knownAlanNumbers: string[];
  onAlanChange: (value: string) => void;
  onRevealAlan: () => void;
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onBack: () => void;
  onNext: (contextText: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContextStep({
  headingRef,
  contextText,
  attachments,
  alanValue,
  alanPrompted,
  detectionNote,
  knownAlanNumbers,
  onAlanChange,
  onRevealAlan,
  onAddFiles,
  onRemoveAttachment,
  onBack,
  onNext,
}: ContextStepProps) {
  const [text, setText] = useState(contextText);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) onAddFiles(dropped);
  }

  return (
    <div className="aaa-flow-panel">
      <p className="aaa-step-label">
        Step 2 <span aria-hidden="true">&middot;</span> Context
      </p>

      <h1 className="aaa-flow-heading-left" tabIndex={-1} ref={headingRef}>
        In your own words, what do you need?
      </h1>

      <div className="aaa-field-group">
        <label className="sr-only" htmlFor="context-text">
          Describe what you need
        </label>
        <textarea
          id="context-text"
          className="aaa-textarea"
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="For example: we want to promote a limited-time rate on term life coverage for members who do not have life insurance yet. We need a direct mail piece and supporting digital ads before the rate expires at the end of next month."
        />
      </div>

      {/*
        A real <button> wrapping a hidden file input. A div with a click handler would not be
        keyboard reachable, and the dropzone must be operable without a mouse (2.1.1).
      */}
      <div className="aaa-field-group">
        <button
          type="button"
          className={dragging ? "aaa-dropzone aaa-dropzone-active" : "aaa-dropzone"}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            aria-hidden="true"
            focusable="false"
          >
            <path d="M10 14V4.5M6.5 8 10 4.5 13.5 8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 13.5v1.5a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 15v-1.5" strokeLinecap="round" />
          </svg>
          <span>
            Attach existing assets, prior campaigns, or brand references{" "}
            <span className="aaa-optional">(optional)</span>
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="sr-only"
          aria-label="Attach files"
          onChange={(event) => {
            const chosen = Array.from(event.target.files ?? []);
            if (chosen.length > 0) onAddFiles(chosen);
            event.target.value = "";
          }}
        />
        <p className="aaa-field-hint">
          File names are recorded now; the files themselves are uploaded when this connects to
          Workfront.
        </p>
      </div>

      {attachments.length > 0 ? (
        <ul role="list" className="aaa-attachment-list">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="aaa-attachment">
              <span className="aaa-attachment-name">{attachment.fileName}</span>
              <span className="aaa-attachment-size">{formatSize(attachment.size)}</span>
              <button
                type="button"
                className="aaa-btn-text-danger"
                onClick={() => onRemoveAttachment(attachment.id)}
              >
                Remove
                <span className="sr-only"> {attachment.fileName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* The ALAN branch. */}
      {alanPrompted ? (
        <div className="aaa-alan-block">
          {detectionNote ? <p className="aaa-field-hint">{detectionNote}</p> : null}
          <AlanCombobox
            value={alanValue}
            onChange={onAlanChange}
            known={knownAlanNumbers}
            label="Do you have an ALAN number?"
          />
          <p className="aaa-field-hint">
            Leave this blank if this is a new piece that does not have one yet.
          </p>
        </div>
      ) : (
        <p className="aaa-field-hint">
          <button type="button" className="aaa-btn-text" onClick={onRevealAlan}>
            I have an ALAN number for this
          </button>
        </p>
      )}

      <div className="aaa-flow-actions">
        <button type="button" className="aaa-btn-text" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="aaa-btn aaa-btn-primary"
          onClick={() => onNext(text)}
          /* Free text is genuinely optional here: the guided questions collect everything
             Workfront requires, so blocking on it would be a made-up gate. */
        >
          Next
        </button>
      </div>
    </div>
  );
}
