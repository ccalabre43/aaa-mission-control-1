/**
 * The Add Tools dialog, per the reference mock: a draft-card form above a list of what is currently
 * on the dashboard.
 *
 * Five deliberate departures from the mock, each because copying it would ship a defect:
 *
 * 1. **The mock's top-right `Add` is gone.** It duplicates the footer's `Add Card`. Two controls doing
 *    one thing in one dialog is a defect to fix, not a layout to reproduce.
 * 2. **The mock's top-right `Save` is gone.** Changes commit as they are made, matching the question
 *    admin, so there is no unsaved-state trap and no way to lose work by closing.
 * 3. **The draft row's checkbox is gone.** There was nothing for it to select.
 * 4. **Sentence case retained** over the mock's Title Case, per guardrail 10: a mock is a layout
 *    reference, not a copy deck.
 * 5. **Cancel is a text button**, not the mock's filled gray one, which is not in the design system
 *    and read as disabled next to the filled blue primary.
 *
 * `DELETE` keeps the mock's red via the existing `aaa-btn-text-danger`, and keeps the two-step confirm
 * the per-question delete already established - red here is a destructive text control, not a primary
 * action, so it stays inside guardrail 4.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_CARD_DESCRIPTION,
  MAX_CARD_LABEL,
  PICKABLE_ICONS,
  PICKABLE_TINTS,
  createCard,
  isEditable,
  validateDraft,
  type CardIcon,
  type CardTint,
  type DashboardCard,
} from "../../lib/dashboard/cards";
import { ToolIcon } from "./ToolIcon";

interface AddToolsDialogProps {
  cards: DashboardCard[];
  onAdd: (card: DashboardCard) => void;
  onDelete: (ids: Set<string>) => void;
  onReset: () => void;
  onClose: () => void;
}

const ICON_LABELS: Record<CardIcon, string> = {
  lines: "Lines",
  document: "Document",
  window: "Window",
  search: "Magnifying glass",
  plus: "Plus",
};

export function AddToolsDialog({
  cards,
  onAdd,
  onDelete,
  onReset,
  onClose,
}: AddToolsDialogProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<CardIcon>("lines");
  const [tint, setTint] = useState<CardTint>("aaa-tile-blue");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [status, setStatus] = useState("");

  const problems = useMemo(
    () => validateDraft({ label, description }),
    [label, description],
  );
  const labelProblem = problems.find((problem) => problem.field === "label");
  const descriptionProblem = problems.find(
    (problem) => problem.field === "description",
  );

  const deletable = cards.filter(isEditable);
  const checkedCount = deletable.filter((card) => checked.has(card.id)).length;

  // 2.4.3 Focus Order: focus moves into the dialog on open, and Escape closes it. The listener is on
  // the window rather than the scrim because a React keydown handler only sees events that bubble
  // from something focused inside it, and focus can legitimately sit outside - clicking Add card
  // disables that button, which drops focus to body.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (problems.length > 0) {
      setStatus(problems[0].message);
      return;
    }
    const card = createCard({
      label: label.trim(),
      description: description.trim(),
      icon,
      tint,
    });
    onAdd(card);
    setStatus(`Added "${card.label}". It shows as not built yet until it has somewhere to go.`);
    // Cleared so a second card can be typed without closing and reopening. Clearing the title also
    // disables Add card, which would drop focus to body, so focus goes back to the title field -
    // which is where someone adding another card wants it anyway.
    setLabel("");
    setDescription("");
    titleRef.current?.focus();
  }

  function handleDelete() {
    const names = deletable
      .filter((card) => checked.has(card.id))
      .map((card) => card.label);
    onDelete(new Set(checked));
    setChecked(new Set());
    setConfirmingDelete(false);
    setStatus(
      names.length === 1
        ? `Removed "${names[0]}".`
        : `Removed ${names.length} cards.`,
    );
    // Yes, remove unmounts itself, and the Delete trigger it returns to is disabled once nothing is
    // checked - either way focus would land on body. The list heading puts it next to what changed.
    listHeadingRef.current?.focus();
  }

  function handleReset() {
    onReset();
    setChecked(new Set());
    setConfirmingReset(false);
    setStatus("The dashboard is back to its four default cards.");
    listHeadingRef.current?.focus();
  }

  return (
    <div
      className="aaa-modal-scrim"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="aaa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tools-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aaa-modal-head">
          <h2 id="add-tools-heading" className="aaa-modal-heading" tabIndex={-1}>
            Add a new card to dashboard
          </h2>
          <button
            type="button"
            className="aaa-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="aaa-modal-body">
          {/* Live region first so an addition or removal is announced regardless of focus. */}
          <div className="sr-only" role="status" aria-live="polite">
            {status}
          </div>

          <section className="aaa-card-draft" aria-labelledby="draft-heading">
            <h3 id="draft-heading" className="aaa-modal-subheading">
              New card
            </h3>

            <div className="aaa-draft-row">
              <span
                className={`aaa-tool-icon ${tint}`}
                /* A live preview of the two pickers below, so the choice is visible before adding. */
                aria-hidden="true"
              >
                <ToolIcon icon={icon} />
              </span>

              <div className="aaa-draft-fields">
                <div className="aaa-field-group">
                  <label className="aaa-label" htmlFor="card-title">
                    Card title
                  </label>
                  <input
                    id="card-title"
                    ref={titleRef}
                    className="aaa-input"
                    value={label}
                    maxLength={MAX_CARD_LABEL}
                    aria-invalid={label.length > 0 && Boolean(labelProblem)}
                    aria-describedby={labelProblem ? "card-title-problem" : undefined}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                  {label.length > 0 && labelProblem ? (
                    <p id="card-title-problem" className="aaa-field-error">
                      {labelProblem.message}
                    </p>
                  ) : null}
                </div>

                <div className="aaa-field-group">
                  <label className="aaa-label" htmlFor="card-description">
                    Card description
                  </label>
                  <input
                    id="card-description"
                    className="aaa-input"
                    value={description}
                    maxLength={MAX_CARD_DESCRIPTION}
                    aria-invalid={Boolean(descriptionProblem)}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </div>
            </div>

            {/*
              Radio groups rather than the mock's single dark square, which showed a "+" with no
              indication of what it would open. A fieldset gives each group a name a screen reader
              can announce, which a row of unlabeled swatches cannot.
            */}
            <fieldset className="aaa-picker">
              <legend className="aaa-label">Icon</legend>
              {PICKABLE_ICONS.map((option) => (
                <label key={option} className="aaa-picker-option">
                  <input
                    type="radio"
                    name="card-icon"
                    value={option}
                    checked={icon === option}
                    onChange={() => setIcon(option)}
                  />
                  <span className="aaa-picker-swatch aaa-tile-ink" aria-hidden="true">
                    <ToolIcon icon={option} />
                  </span>
                  <span>{ICON_LABELS[option]}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="aaa-picker">
              <legend className="aaa-label">Color</legend>
              {PICKABLE_TINTS.map((option) => (
                <label key={option.tint} className="aaa-picker-option">
                  <input
                    type="radio"
                    name="card-tint"
                    value={option.tint}
                    checked={tint === option.tint}
                    onChange={() => setTint(option.tint)}
                  />
                  {/* The name is the adjacent text, never the swatch alone - color is not a label. */}
                  <span
                    className={`aaa-picker-swatch ${option.tint}`}
                    aria-hidden="true"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
          </section>

          <section aria-labelledby="current-heading">
            <div className="aaa-modal-listhead">
              <h3
                id="current-heading"
                className="aaa-modal-subheading"
                ref={listHeadingRef}
                tabIndex={-1}
              >
                Current dashboard
              </h3>
              {confirmingDelete ? (
                <span className="aaa-modal-confirm">
                  <span className="aaa-modal-confirm-prompt">
                    Remove {checkedCount === 1 ? "this card" : `these ${checkedCount} cards`}?
                  </span>
                  <button
                    type="button"
                    className="aaa-btn-text-danger"
                    autoFocus
                    onClick={handleDelete}
                  >
                    Yes, remove
                  </button>
                  <button
                    type="button"
                    className="aaa-btn-text"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                /*
                  Left enabled with nothing checked, and answers instead of doing nothing. Red stays
                  red here by request, and `.aaa-btn-text-danger` has no disabled styling - so a
                  disabled version would look identical to a live one and read as a dead control.
                  Saying "select a card first" is the accessible version of the same refusal.
                */
                <button
                  type="button"
                  className="aaa-btn-text-danger"
                  onClick={() => {
                    if (checkedCount === 0) {
                      setStatus("Select a card to remove first.");
                      return;
                    }
                    setConfirmingDelete(true);
                  }}
                >
                  Delete
                  <span className="sr-only">
                    {checkedCount === 0
                      ? ", nothing selected yet"
                      : ` ${checkedCount} selected`}
                  </span>
                </button>
              )}
            </div>

            <ul role="list" className="aaa-card-list">
              {cards.map((card) => (
                <li key={card.id} className="aaa-card-row">
                  <span className={`aaa-tool-icon ${card.tint}`} aria-hidden="true">
                    <ToolIcon icon={card.icon} />
                  </span>
                  <span className="aaa-card-row-text">
                    <span className="aaa-tool-label">{card.label}</span>
                    {card.description ? (
                      <span className="aaa-tool-desc">{card.description}</span>
                    ) : null}
                  </span>

                  {isEditable(card) ? (
                    <label className="aaa-card-check">
                      <input
                        type="checkbox"
                        checked={checked.has(card.id)}
                        onChange={() => toggle(card.id)}
                      />
                      {/* An unlabeled checkbox is unusable by screen reader, and the mock has four. */}
                      <span className="sr-only">Select {card.label}</span>
                    </label>
                  ) : (
                    <span className="aaa-card-pinned">Always last</span>
                  )}
                </li>
              ))}
            </ul>

            {status ? <p className="aaa-field-hint">{status}</p> : null}
          </section>
        </div>

        <div className="aaa-modal-foot">
          <button
            type="button"
            className="aaa-btn aaa-btn-primary"
            disabled={!label.trim()}
            onClick={handleAdd}
          >
            Add card
          </button>
          <button type="button" className="aaa-btn-text" onClick={onClose}>
            Cancel
          </button>

          {confirmingReset ? (
            <span className="aaa-modal-confirm">
              <span className="aaa-modal-confirm-prompt">
                Replace the dashboard with the four default cards?
              </span>
              <button
                type="button"
                className="aaa-btn-text-danger"
                autoFocus
                onClick={handleReset}
              >
                Yes, reset
              </button>
              <button
                type="button"
                className="aaa-btn-text"
                onClick={() => setConfirmingReset(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="aaa-btn-text aaa-modal-reset"
              onClick={() => setConfirmingReset(true)}
            >
              Reset to default cards
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
