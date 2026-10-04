/**
 * Local saved versions of the Request Queue, and the sample data used to develop it.
 *
 * Sits on the Request Queue screen rather than in a settings page because it is about *this* data and
 * loses its meaning away from it. It is explicitly a stopgap until Workfront is connected, and the
 * copy says so - a snapshot is a file on one device, not a shared record, and two people with two
 * files have two unrelated truths.
 *
 * Asymmetric confirmation, on purpose:
 *
 * - **Import** replaces everything, so it gets a confirm step and an Undo afterwards.
 * - **Load samples** cannot destroy anything - fixed `sample-` ids, upserted - so asking would be
 *   friction that teaches people to click through confirmations.
 */
import { useRef, useState } from "react";
import {
  applySnapshot,
  buildSnapshot,
  describeSnapshot,
  downloadSnapshot,
  hasRollback,
  parseSnapshot,
  rollback,
  type SnapshotMeta,
} from "../../lib/snapshot/snapshot";
import { loadBriefs, saveBriefs } from "../../lib/intake/storage";
import {
  countSampleBriefs,
  withSamples,
  withoutSamples,
} from "../../lib/dev/sampleQueue";

interface SavedVersionsSectionProps {
  /** Re-read storage after anything here rewrites it. */
  onDataChanged: () => void;
  /** Sample counts and the Undo affordance both depend on what is currently loaded. */
  sampleCount: number;
}

export function SavedVersionsSection({
  onDataChanged,
  sampleCount,
}: SavedVersionsSectionProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState("");
  const [problem, setProblem] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, setPending] = useState<{ text: string; meta: SnapshotMeta } | null>(
    null,
  );
  const [undoAvailable, setUndoAvailable] = useState(() => hasRollback());

  function reset() {
    setStatus("");
    setProblem("");
    setWarnings([]);
  }

  function handleExport() {
    reset();
    const snapshot = buildSnapshot();
    const fileName = downloadSnapshot(snapshot);
    setStatus(
      `Saved ${fileName} to your downloads. It holds ${describeSnapshot(snapshot.meta)}.`,
    );
  }

  async function handleFile(file: File) {
    reset();
    const text = await file.text();
    const outcome = parseSnapshot(text);
    if (!outcome.ok) {
      setProblem(outcome.reason);
      return;
    }
    // Parsed and held, not applied. The confirm step needs something true to describe.
    setPending({ text, meta: outcome.snapshot.meta });
    setWarnings(outcome.warnings);
  }

  function confirmImport() {
    if (!pending) return;
    const outcome = parseSnapshot(pending.text);
    if (!outcome.ok) {
      setProblem(outcome.reason);
      setPending(null);
      return;
    }
    const result = applySnapshot(outcome.snapshot);
    setPending(null);
    setUndoAvailable(result.rollbackStored);
    if (result.failedKeys.length > 0) {
      setProblem(
        `Restored ${result.restoredKeys.length} of ${
          result.restoredKeys.length + result.failedKeys.length
        } parts. This browser refused to store the rest, which usually means storage is full.`,
      );
    } else {
      setStatus(
        `Restored ${describeSnapshot(outcome.snapshot.meta)}.${
          result.rollbackStored ? " Undo is available until you leave this screen." : ""
        }`,
      );
    }
    onDataChanged();
  }

  function handleUndo() {
    reset();
    const result = rollback();
    setUndoAvailable(false);
    if (!result) {
      setProblem("There was no saved state to go back to, so nothing changed.");
      return;
    }
    setStatus("Put back the requests and settings from before the import.");
    onDataChanged();
  }

  function handleLoadSamples() {
    reset();
    const { briefs } = loadBriefs();
    const next = withSamples(briefs);
    const result = saveBriefs(next);
    if (!result.ok) {
      setProblem(result.reason ?? "The sample requests could not be saved.");
      return;
    }
    setStatus(
      `Loaded ${countSampleBriefs(next)} sample requests. Each one is titled SAMPLE so it cannot be mistaken for real work. Loading again replaces them rather than adding more.`,
    );
    onDataChanged();
  }

  function handleRemoveSamples() {
    reset();
    const { briefs } = loadBriefs();
    const result = saveBriefs(withoutSamples(briefs));
    if (!result.ok) {
      setProblem(result.reason ?? "The sample requests could not be removed.");
      return;
    }
    setStatus("Removed the sample requests. Your own requests were not touched.");
    onDataChanged();
  }

  return (
    <section className="aaa-queue aaa-queue-versions" aria-labelledby="saved-versions-heading">
      <div className="mb-4">
        <h2 id="saved-versions-heading" className="aaa-queue-heading" tabIndex={-1}>
          Saved versions
        </h2>
        <p className="aaa-queue-sub">
          Until Workfront is connected, a snapshot file is the only copy of this queue that
          survives clearing your browser or switching to a different one. It is a file on this
          device, not a shared record.
        </p>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {status || problem}
      </div>

      <div className="aaa-versions-actions">
        <button type="button" className="aaa-btn aaa-btn-primary" onClick={handleExport}>
          Export a snapshot
        </button>

        {/* A label wrapping a visually hidden input, matching the tracker's Import Excel control. */}
        <label className="aaa-btn aaa-btn-secondary">
          Import a snapshot
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              // Cleared so choosing the same file twice fires change again.
              event.target.value = "";
            }}
          />
        </label>

        {undoAvailable ? (
          <button type="button" className="aaa-btn-text" onClick={handleUndo}>
            Undo the last import
          </button>
        ) : null}
      </div>

      {pending ? (
        <div className="aaa-attention">
          <p>
            <strong>Import this snapshot?</strong> It holds{" "}
            {describeSnapshot(pending.meta)}. This replaces the requests, queue topics, question
            set, and tracker rows in this browser. Your saved name and email are not affected.
          </p>
          {warnings.length > 0 ? (
            <ul className="aaa-attention-list">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <div className="aaa-versions-actions">
            <button type="button" className="aaa-btn aaa-btn-primary" onClick={confirmImport}>
              Replace and import
            </button>
            <button
              type="button"
              className="aaa-btn-text"
              onClick={() => {
                setPending(null);
                setWarnings([]);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="aaa-versions-samples">
        <h3 className="aaa-versions-subheading">Sample requests</h3>
        <p className="aaa-field-hint">
          Five fake requests covering a draft, a both-teams triage, a compliance flag, and a
          request with no recorded route. Useful for building queue features without walking the
          flow each time. Every requester is fictional and every title starts with SAMPLE.
        </p>
        <div className="aaa-versions-actions">
          <button type="button" className="aaa-btn aaa-btn-secondary" onClick={handleLoadSamples}>
            Load sample requests
          </button>
          {sampleCount > 0 ? (
            <button type="button" className="aaa-btn-text" onClick={handleRemoveSamples}>
              Remove {sampleCount} sample request{sampleCount === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
      </div>

      {status ? <p className="aaa-field-hint">{status}</p> : null}
      {problem ? <p className="aaa-attention">{problem}</p> : null}

      <p className="aaa-versions-privacy">
        A snapshot contains requester names, email addresses, and departments, which are PII. Keep
        it on your own device, never commit it to a repository, and treat sharing one as a privacy
        decision rather than a convenience.
      </p>
    </section>
  );
}
