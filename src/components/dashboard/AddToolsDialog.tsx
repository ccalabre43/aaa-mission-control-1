/**
 * Add a tool dialog — Concept v1 node 369-4561.
 *
 * The frame is add-only. Current dashboard / Delete / Reset stay below the form because they are
 * the only in-app path to remove or restore cards. Add validation, Escape, and focus handling match
 * the previous dialog.
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
import closeSrc from "../../assets/dashboard-icons/modal-close.svg";

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
  palette: "Palette",
  chat: "Chat",
  frame: "Frame",
  chart: "Chart",
  briefcase: "Briefcase",
  star: "Star",
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
  const [icon, setIcon] = useState<CardIcon>("palette");
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
    setStatus(`Added "${card.label}" to the dashboard.`);
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
        className="aaa-modal aaa-modal-add-tool"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tools-heading"
        aria-describedby="add-tools-lead"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aaa-modal-head aaa-modal-head-add">
          <div className="aaa-modal-head-copy">
            <h2
              id="add-tools-heading"
              className="aaa-modal-heading"
              tabIndex={-1}
              ref={headingRef}
            >
              Add a tool
            </h2>
            <p id="add-tools-lead" className="aaa-modal-lead">
              Adds a new card to your dashboard.
            </p>
          </div>
          <button
            type="button"
            className="aaa-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <img
              src={closeSrc}
              alt=""
              width={24}
              height={24}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="aaa-modal-body">
          <div className="sr-only" role="status" aria-live="polite">
            {status}
          </div>

          <section className="aaa-card-draft-figma" aria-label="New tool">
            <div className="aaa-field-shell">
              <label className="aaa-field-shell-label" htmlFor="card-title">
                Tool name*
              </label>
              <input
                id="card-title"
                ref={titleRef}
                className="aaa-field-shell-input"
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

            <div className="aaa-field-shell">
              <label className="aaa-field-shell-label" htmlFor="card-description">
                Description*
              </label>
              <input
                id="card-description"
                className="aaa-field-shell-input"
                value={description}
                maxLength={MAX_CARD_DESCRIPTION}
                aria-invalid={Boolean(descriptionProblem)}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <fieldset className="aaa-picker aaa-picker-icons">
              <legend className="aaa-picker-legend">Icon</legend>
              {PICKABLE_ICONS.map((option) => (
                <label key={option} className="aaa-picker-chip">
                  <input
                    type="radio"
                    name="card-icon"
                    value={option}
                    checked={icon === option}
                    onChange={() => setIcon(option)}
                  />
                  <span className="aaa-picker-icon-face aaa-tile-charcoal" aria-hidden="true">
                    <ToolIcon icon={option} compact />
                  </span>
                  <span className="sr-only">{ICON_LABELS[option]}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="aaa-picker aaa-picker-colors">
              <legend className="aaa-picker-legend">Color</legend>
              {PICKABLE_TINTS.map((option) => (
                <label key={option.tint} className="aaa-picker-chip aaa-picker-chip-round">
                  <input
                    type="radio"
                    name="card-tint"
                    value={option.tint}
                    checked={tint === option.tint}
                    onChange={() => setTint(option.tint)}
                  />
                  <span className={`aaa-picker-color-face ${option.tint}`} aria-hidden="true" />
                  <span className="sr-only">{option.label}</span>
                </label>
              ))}
            </fieldset>
          </section>

          <section aria-labelledby="current-heading" className="aaa-modal-manage">
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
                      <span className="sr-only">Select {card.label}</span>
                    </label>
                  ) : (
                    <span className="aaa-card-pinned">Always last</span>
                  )}
                </li>
              ))}
            </ul>

            {status ? <p className="aaa-field-hint">{status}</p> : null}

            {confirmingReset ? (
              <span className="aaa-modal-confirm aaa-modal-reset-row">
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
                className="aaa-btn-text aaa-modal-reset-inline"
                onClick={() => setConfirmingReset(true)}
              >
                Reset to default cards
              </button>
            )}
          </section>
        </div>

        <div className="aaa-modal-foot aaa-modal-foot-end">
          <button type="button" className="aaa-btn-text aaa-btn-text-blue" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="aaa-btn aaa-btn-primary"
            disabled={!label.trim()}
            onClick={handleAdd}
          >
            Add to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
