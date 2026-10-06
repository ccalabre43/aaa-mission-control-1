/**
 * Manage questions: reorder, reword, toggle, and add questions to the guided set.
 *
 * No mock exists for this screen, so it is built from established patterns and is flagged for
 * review rather than treated as designed.
 *
 * The important behavior is what it refuses to do. Six A3 fields are required by Workfront. Five of
 * them are fed by a guided question, and those five are locked: rewordable, but never deletable or
 * disableable. The sixth, `A3IntakeRequestedBy`, is collected at the Start step, which is why this
 * screen shows five locked cards rather than six.
 *
 * The alternative is an admin quietly creating a question set that cannot be submitted, and the
 * person who discovers it is a requester who has already answered eight questions. Nothing
 * downstream catches it either: `validateRegistry` checks that a locked question is not disabled,
 * and a deleted question is not there to check.
 *
 * Everything else is deletable, including the four built-ins whose fields are optional.
 * `resetRegistry` brings a default back, so refusing to delete one bought nothing.
 *
 * Changes are versioned. A draft in flight keeps the set it started with.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  A3_CATCH_ALL_FIELD,
  A3_PARAGRAPH_FIELD_NAMES,
  getA3Field,
  isOptionField,
  isSingleValueField,
  type A3FieldName,
} from "../lib/intake/a3Schema";
import {
  canDisable,
  canRemove,
  createCustomQuestion,
  isLocked,
  loadRegistry,
  moveQuestion,
  resetRegistry,
  saveRegistry,
  validateRegistry,
  type QuestionDef,
  type QuestionRegistry,
} from "../lib/intake/questionRegistry";

export default function ManageQuestionsView() {
  const [registry, setRegistry] = useState<QuestionRegistry>(() => loadRegistry());
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  /* Which row is mid-confirm. One at a time: opening a second confirm closes the first, so two
     armed delete buttons can never sit on screen at once. */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestionDef>(() => createCustomQuestion());

  const problems = validateRegistry(registry);
  const enabledCount = registry.questions.filter((question) => question.enabled).length;

  function commit(next: QuestionRegistry, message: string) {
    const saved = saveRegistry(next);
    setRegistry(saved);
    setStatus(message);
  }

  function patchQuestion(id: string, patch: Partial<QuestionDef>) {
    setRegistry((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    }));
  }

  function saveAll() {
    const found = validateRegistry(registry);
    if (found.length > 0) {
      setStatus("Fix the problems listed below before saving.");
      return;
    }
    commit(registry, `Saved. Requesters now see ${enabledCount} questions.`);
  }

  function addCustom() {
    if (!draft.label.trim()) {
      setStatus("Give the question a label before adding it.");
      return;
    }
    const next: QuestionRegistry = {
      ...registry,
      questions: [...registry.questions, draft],
    };
    commit(next, `Added "${draft.label.trim()}".`);
    setDraft(createCustomQuestion());
    setAdding(false);
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="aaa-page-heading">Manage intake questions</h1>
      <p className="aaa-page-sub">
        These are the questions a requester answers, in this order. Requesters currently see{" "}
        {enabledCount} {enabledCount === 1 ? "question" : "questions"}.
      </p>

      <div className="aaa-notice">
        <p>
          Five questions are locked because Workfront requires the fields behind them. You can
          reword a locked question, but not turn it off or delete it - a request missing one of
          those fields cannot be submitted. Workfront requires a sixth field, the requester, and
          that one is collected at the start of the request rather than as a question here.
        </p>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
      {status ? <p className="aaa-page-status">{status}</p> : null}

      {problems.length > 0 ? (
        <div role="alert" className="aaa-flow-alert">
          <ul role="list">
            {problems.map((problem) => (
              <li key={`${problem.questionId}-${problem.message}`}>{problem.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="aaa-question-admin-list">
        {registry.questions.map((question, index) => {
          const locked = isLocked(question);
          const field = getA3Field(question.target);
          return (
            <li key={question.id} className="aaa-question-admin">
              <div className="aaa-question-admin-head">
                <span className="aaa-question-admin-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="aaa-question-admin-target">
                  {field.label}
                  {locked ? (
                    <span className="aaa-badge aaa-badge-locked">
                      Required by Workfront
                    </span>
                  ) : null}
                  {question.custom ? (
                    <span className="aaa-badge aaa-badge-custom">Custom</span>
                  ) : null}
                </span>
              </div>

              <div className="aaa-field-group">
                <label className="aaa-label" htmlFor={`label-${question.id}`}>
                  Question wording
                </label>
                <input
                  id={`label-${question.id}`}
                  className="aaa-input"
                  value={question.label}
                  onChange={(event) =>
                    patchQuestion(question.id, { label: event.target.value })
                  }
                />
              </div>

              <div className="aaa-field-group">
                <label className="aaa-label" htmlFor={`helper-${question.id}`}>
                  Helper text
                </label>
                <input
                  id={`helper-${question.id}`}
                  className="aaa-input"
                  value={question.helper}
                  onChange={(event) =>
                    patchQuestion(question.id, { helper: event.target.value })
                  }
                />
              </div>

              {/*
                Only for fields with fixed options. Offering it anywhere else would create a
                question validateRegistry immediately rejects, which is a worse experience than not
                offering it at all.
              */}
              {isOptionField(question.target) ? (
                <div className="aaa-field-group">
                  <label className="aaa-label" htmlFor={`arity-${question.id}`}>
                    How many can be chosen
                  </label>
                  <select
                    id={`arity-${question.id}`}
                    className="aaa-input"
                    value={question.inputType === "checkbox" ? "several" : "one"}
                    onChange={(event) =>
                      patchQuestion(question.id, {
                        inputType:
                          event.target.value === "several" ? "checkbox" : "radio",
                      })
                    }
                  >
                    <option value="one">One only</option>
                    <option value="several">One or more</option>
                  </select>
                  {isSingleValueField(question.target) &&
                  question.inputType === "checkbox" ? (
                    <p className="aaa-field-hint">
                      {getA3Field(question.target).label} accepts a single value in Workfront. When
                      a requester picks more than one, every choice is recorded in the request
                      description so routing is not lost. Converting the Workfront field to a
                      checkbox group is an open configuration request.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="aaa-question-admin-actions">
                {/* Buttons rather than drag-only, so reordering works from the keyboard (2.1.1). */}
                <button
                  type="button"
                  className="aaa-btn-text"
                  onClick={() =>
                    commit(
                      moveQuestion(registry, question.id, -1),
                      `Moved "${question.label}" to position ${index}.`,
                    )
                  }
                  disabled={index === 0}
                >
                  Move up
                  <span className="sr-only"> {question.label}</span>
                </button>
                <button
                  type="button"
                  className="aaa-btn-text"
                  onClick={() =>
                    commit(
                      moveQuestion(registry, question.id, 1),
                      `Moved "${question.label}" to position ${index + 2}.`,
                    )
                  }
                  disabled={index === registry.questions.length - 1}
                >
                  Move down
                  <span className="sr-only"> {question.label}</span>
                </button>

                {canDisable(question) ? (
                  <label className="aaa-toggle-row">
                    <input
                      type="checkbox"
                      checked={question.enabled}
                      onChange={(event) =>
                        patchQuestion(question.id, { enabled: event.target.checked })
                      }
                    />
                    <span>Ask this question</span>
                  </label>
                ) : (
                  /* Carries the reason this card has neither a toggle nor a delete control. */
                  <span className="aaa-question-admin-locked">
                    Always asked - required by Workfront
                  </span>
                )}

                {/*
                  Two steps, because this is the only irreversible action on the screen and there is
                  no undo: the typed wording of a question is gone once it is deleted. The confirm
                  replaces the trigger in place rather than opening a dialog, so the row does not
                  reflow and the decision stays next to the question it applies to.
                */}
                {confirmDeleteId === question.id ? (
                  <span
                    className="aaa-question-admin-confirm"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setConfirmDeleteId(null);
                    }}
                  >
                    <span className="aaa-question-admin-confirm-prompt">Delete this?</span>
                    <button
                      type="button"
                      className="aaa-btn-text aaa-question-admin-delete"
                      /* Focused on mount, or a keyboard user is stranded on body when the trigger
                         they activated is replaced. autoFocus rather than a callback ref, which
                         would re-fire on every render and fight the user for focus. */
                      autoFocus
                      onClick={() => {
                        setConfirmDeleteId(null);
                        commit(
                          {
                            ...registry,
                            questions: registry.questions.filter(
                              (item) => item.id !== question.id,
                            ),
                          },
                          `Deleted "${question.label}".`,
                        );
                      }}
                    >
                      Yes, delete
                      <span className="sr-only"> {question.label}</span>
                    </button>
                    <button
                      type="button"
                      className="aaa-btn-text"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </span>
                ) : canRemove(question) ? (
                  /*
                    Rendered only where it works, so every "Delete this question" on the screen is
                    red and live. The earlier version rendered a dimmed one on the locked cards too;
                    that put grey delete links on most of the screen and gave the five locked cards a
                    control that silently did nothing when clicked. The locked cards say "Always
                    asked - required by Workfront" in this same row instead, which explains the
                    absence of both this control and the toggle.
                  */
                  <button
                    type="button"
                    className="aaa-btn-text aaa-question-admin-delete"
                    onClick={() => setConfirmDeleteId(question.id)}
                  >
                    Delete this question
                    <span className="sr-only"> {question.label}</span>
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {adding ? (
        <section className="aaa-question-admin" aria-labelledby="add-heading">
          <h2 id="add-heading" className="aaa-question-admin-target">
            New question
          </h2>

          <div className="aaa-field-group">
            <label className="aaa-label" htmlFor="new-label">
              Question wording
            </label>
            <input
              id="new-label"
              className="aaa-input"
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            />
          </div>

          <div className="aaa-field-group">
            <label className="aaa-label" htmlFor="new-helper">
              Helper text
            </label>
            <input
              id="new-helper"
              className="aaa-input"
              value={draft.helper}
              onChange={(event) => setDraft({ ...draft, helper: event.target.value })}
            />
          </div>

          <div className="aaa-field-group">
            <label className="aaa-label" htmlFor="new-target">
              Where the answer goes in Workfront
            </label>
            <select
              id="new-target"
              className="aaa-input"
              value={draft.target}
              onChange={(event) =>
                setDraft({ ...draft, target: event.target.value as A3FieldName })
              }
            >
              {A3_PARAGRAPH_FIELD_NAMES.map((name) => (
                <option key={name} value={name}>
                  {getA3Field(name).label}
                  {name === A3_CATCH_ALL_FIELD ? " (recommended)" : ""}
                </option>
              ))}
            </select>
            <p className="aaa-field-hint">
              Only existing Workfront fields are listed. A custom question is appended to its
              field, labeled with the question, so a producer can still tell what was asked.
            </p>
          </div>

          <div className="aaa-question-admin-actions">
            <button type="button" className="aaa-btn aaa-btn-primary" onClick={addCustom}>
              Add question
            </button>
            <button
              type="button"
              className="aaa-btn-text"
              onClick={() => {
                setAdding(false);
                setDraft(createCustomQuestion());
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        /* Deleting is reached from the question itself, never from here. A bottom-of-screen picker
           duplicated the per-row control and made the admin re-identify by label something they were
           already looking at. */
        <button
          type="button"
          className="aaa-btn aaa-btn-secondary mt-4"
          onClick={() => setAdding(true)}
        >
          Add a question
        </button>
      )}

      <div className="aaa-admin-footer">
        <button type="button" className="aaa-btn aaa-btn-primary" onClick={saveAll}>
          Save changes
        </button>
        <button
          type="button"
          className="aaa-btn-text"
          onClick={() => {
            setRegistry(resetRegistry());
            setStatus("Reset to the nine default questions.");
          }}
        >
          Reset to defaults
        </button>
        <Link to="/" className="aaa-link-quiet">
          Back to Mission Control
        </Link>
      </div>
    </main>
  );
}
