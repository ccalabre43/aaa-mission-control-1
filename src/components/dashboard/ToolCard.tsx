/**
 * One dashboard tile, plus the reorder affordance in its upper-right corner.
 *
 * Three routes to the same reorder, because dragging alone is not enough:
 *
 * 1. **Pointer drag.** The grip is the drag source, not the whole card. Making the card draggable
 *    would fight the browser's native link dragging on the tiles that are real links, and dragging a
 *    link is how you end up with a URL dropped into the address bar instead of a reordered grid.
 * 2. **Keyboard.** Arrow keys move the card while the grip has focus (WCAG 2.1.1). Left and right for
 *    the four-across desktop grid, up and down as well, since the grid is two-across under 900px and
 *    "up" is the honest direction there.
 * 3. **Single pointer, no dragging.** The grip is a toggle that reveals Move left and Move right
 *    buttons. This is the WCAG 2.5.7 Dragging Movements alternative, which is AA in WCAG 2.2 and
 *    therefore the floor per guardrail 9 - a drag-only control excludes anyone who can click but
 *    cannot hold and drag. It also follows the Move up and Move down precedent already set in
 *    `ManageQuestionsView`.
 *
 * The manager card gets none of this. It is the control that manages the grid rather than content in
 * it, so it stays pinned last and is neither movable nor removable.
 */
import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { isEditable, type DashboardCard } from "../../lib/dashboard/cards";
import { GripIcon, ToolIcon } from "./ToolIcon";

interface ToolCardProps {
  card: DashboardCard;
  /** 1-based position among the orderable cards, announced to screen readers. */
  position: number;
  total: number;
  /** True when this card's grip is armed, which is what reveals the Move buttons. */
  armed: boolean;
  /** True while any card is being dragged, so drop targets can show themselves. */
  dragging: boolean;
  isDropTarget: boolean;
  /**
   * Increments each time this card's grip should retake focus. A counter rather than a boolean
   * because a boolean stuck at true never fires the effect again, so only the first of several
   * consecutive moves would restore focus.
   */
  refocus: number;
  onToggleArm: () => void;
  onDisarm: () => void;
  onMove: (delta: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragEnterCard: () => void;
  onDropOnCard: () => void;
  onOpenManager: () => void;
}

export function ToolCard({
  card,
  position,
  total,
  armed,
  dragging,
  isDropTarget,
  refocus,
  onToggleArm,
  onDisarm,
  onMove,
  onDragStart,
  onDragEnd,
  onDragEnterCard,
  onDropOnCard,
  onOpenManager,
}: ToolCardProps) {
  const gripRef = useRef<HTMLButtonElement | null>(null);
  const editable = isEditable(card);

  /**
   * Focus lands on the grip after every move, including one driven by the Move buttons.
   *
   * Reordering moves this card in the DOM, and a Move button can disable itself by arriving at an
   * end of the row - either way focus would otherwise drop to `body`, stranding a keyboard user
   * mid-task. The grip is always present and always enabled, and its name carries the new position.
   */
  useEffect(() => {
    if (refocus > 0) gripRef.current?.focus();
  }, [refocus]);

  function handleGripKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onMove(-1);
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onMove(1);
      return;
    }
    if (event.key === "Escape" && armed) {
      event.preventDefault();
      onToggleArm();
    }
  }

  const body = (
    <>
      <span className={`aaa-tool-icon ${card.tint}`}>
        <ToolIcon icon={card.icon} />
      </span>
      <span className="aaa-tool-label">{card.label}</span>
      {card.description ? (
        <span className="aaa-tool-desc">{card.description}</span>
      ) : null}
    </>
  );

  let inner: React.ReactNode;
  if (card.manager) {
    // A real button, because it performs an action rather than navigating.
    inner = (
      <button
        type="button"
        className="aaa-tool-card aaa-tool-card-ready aaa-tool-card-manager"
        onClick={onOpenManager}
      >
        {body}
      </button>
    );
  } else if (card.to) {
    inner = (
      <Link
        to={card.to}
        className="aaa-tool-card aaa-tool-card-ready"
        /* The grip owns dragging. A draggable link would start a link-drag from the card body. */
        draggable={false}
      >
        {body}
      </Link>
    );
  } else {
    /* Not a link and not a disabled button: a real element that explains its state, so keyboard
       users can still read it and nobody chases a dead control. */
    inner = (
      <div className="aaa-tool-card aaa-tool-card-soon">
        {body}
        <span className="aaa-tool-soon">Not built yet</span>
      </div>
    );
  }

  const cellClasses = ["aaa-tool-cell"];
  if (isDropTarget) cellClasses.push("aaa-tool-cell-over");
  if (armed) cellClasses.push("aaa-tool-cell-armed");

  return (
    <li
      className={cellClasses.join(" ")}
      /*
        The grip hides when the pointer leaves, so an armed card has to disarm with it. Otherwise the
        Move buttons would still be mounted and the card still armed, with nothing on screen saying
        so - an active state nobody can see.

        Skipped only for a keyboard user, who has not finished just because a mouse happened to travel
        across the card and off again. The test is `:focus-visible`, matching the CSS reveal: a plain
        `contains(activeElement)` check also matches the click that armed it, since Chrome focuses a
        button when you click it - which left the card armed and the Move buttons mounted with nothing
        on screen saying so.
      */
      onMouseLeave={(event) => {
        if (!armed) return;
        const focused = document.activeElement;
        const keyboardHeld =
          focused instanceof HTMLElement &&
          event.currentTarget.contains(focused) &&
          focused.matches(":focus-visible");
        if (keyboardHeld) return;
        onDisarm();
      }}
      onDragOver={(event) => {
        // Without preventDefault the browser refuses the drop outright.
        if (dragging && editable) event.preventDefault();
      }}
      onDragEnter={() => {
        if (dragging && editable) onDragEnterCard();
      }}
      onDrop={(event) => {
        if (!dragging || !editable) return;
        event.preventDefault();
        onDropOnCard();
      }}
    >
      {inner}

      {editable ? (
        <span className="aaa-tool-reorder">
          {/*
            aria-pressed rather than a plain button: the armed state is the thing a screen reader
            user needs to know, since it is what makes the Move buttons appear. The position is in
            the name because "Reorder Strategy" alone does not say where Strategy currently is.
          */}
          <button
            ref={gripRef}
            type="button"
            className="aaa-tool-handle"
            aria-pressed={armed}
            aria-label={`Reorder ${card.label}, position ${position} of ${total}`}
            draggable
            onDragStart={(event) => {
              // Some browsers will not start a drag without data on the transfer.
              event.dataTransfer.setData("text/plain", card.id);
              event.dataTransfer.effectAllowed = "move";
              onDragStart();
            }}
            onDragEnd={onDragEnd}
            onClick={onToggleArm}
            onKeyDown={handleGripKeyDown}
          >
            <GripIcon />
          </button>

          {armed ? (
            <>
              <button
                type="button"
                className="aaa-tool-nudge"
                aria-label={`Move ${card.label} left`}
                disabled={position <= 1}
                onClick={() => onMove(-1)}
              >
                <span aria-hidden="true">&#8592;</span>
              </button>
              <button
                type="button"
                className="aaa-tool-nudge"
                aria-label={`Move ${card.label} right`}
                disabled={position >= total}
                onClick={() => onMove(1)}
              >
                <span aria-hidden="true">&#8594;</span>
              </button>
            </>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}
