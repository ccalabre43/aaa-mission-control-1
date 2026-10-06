/**
 * Mission Control home, per assets/mocks/main-dashboard-interface.png and
 * main-mobile-dashboard-interface.png.
 *
 * Copy reconciliation between the two mocks:
 * - Desktop asks "What would you like to do today?", mobile "What do you want to do today?".
 *   The desktop wording is canonical.
 * - Desktop labels the tiles "Intake Form / Strategy / Deep Dive / Add Tools" with a description
 *   line each; mobile drops the descriptions and says "Intake Tools / Strategy Tools". The desktop
 *   labels and descriptions are canonical, since a tile that explains itself is worth the space.
 * - Only the mobile mock draws a "Start request" button. It is kept at every breakpoint: three of
 *   the four tiles are not built yet, so an unmistakable primary action matters more than matching
 *   the desktop mock exactly (Von Restorff Effect, and a single clear CTA per screen). It ships as
 *   "Start Request" by request. That is the only title-case action label in the app; every other
 *   one is sentence case, so match the neighbors rather than this if you add a button nearby.
 *
 * Tiles with nowhere to go are rendered as genuinely unavailable rather than as working links. A tile
 * that looks clickable and does nothing is worse than one that says it is not ready. That state now
 * carries added cards too, which are roadmap placeholders by design.
 *
 * The tiles come from `localStorage` rather than a constant here, so they can be added to, removed,
 * and reordered. `defaultCards()` still holds the shipped four.
 */
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { clearIntakeData } from "../lib/intake/storage";
import {
  defaultCards,
  moveCard,
  moveCardTo,
  orderableCards,
  positionOf,
  removeCards,
  withManagerLast,
  type DashboardCard,
} from "../lib/dashboard/cards";
import { cardsLoadMessage, loadCards, resetCards, saveCards } from "../lib/dashboard/storage";
import { AddToolsDialog } from "../components/dashboard/AddToolsDialog";
import { ToolCard } from "../components/dashboard/ToolCard";
import { ToolIcon } from "../components/dashboard/ToolIcon";

export default function HomeView() {
  const [cleared, setCleared] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const [cards, setCards] = useState<DashboardCard[]>(defaultCards);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  /**
   * Which grip should retake focus, and a tick so repeated moves of the same card each fire.
   * Set by the stepped moves only - a pointer drag must not yank focus to the grip.
   */
  const [refocus, setRefocus] = useState<{ id: string; tick: number }>({ id: "", tick: 0 });
  const [reorderNote, setReorderNote] = useState("");

  useEffect(() => {
    const result = loadCards();
    setCards(result.cards);
    setLoadNote(cardsLoadMessage(result.status));
  }, []);

  const orderable = useMemo(() => orderableCards(cards), [cards]);

  /**
   * Single write path, so no branch can change the grid without persisting it.
   *
   * Normalizes before setting state, not just before saving. Saving alone left rendered order and
   * stored order disagreeing: a freshly added card appeared after Add Tools until the next reload
   * quietly corrected it.
   */
  function commit(cardsToCommit: DashboardCard[]) {
    const next = withManagerLast(cardsToCommit);
    setCards(next);
    const result = saveCards(next);
    setSaveProblem(result.ok ? null : (result.reason ?? null));
    // A stale recovery note next to a fresh save would misreport the current state.
    if (result.ok) setLoadNote(null);
  }

  function handleMove(id: string, delta: number) {
    const next = moveCard(cards, id, delta);
    if (next === cards) {
      // Refused, so say why rather than going silent and looking broken.
      const card = cards.find((candidate) => candidate.id === id);
      setReorderNote(
        `${card?.label ?? "Card"} is already ${delta < 0 ? "first" : "last"}.`,
      );
      return;
    }
    commit(next);
    const card = next.find((candidate) => candidate.id === id);
    setReorderNote(
      `${card?.label ?? "Card"} moved to position ${positionOf(next, id)} of ${
        orderableCards(next).length
      }.`,
    );
    setRefocus((current) => ({ id, tick: current.tick + 1 }));
  }

  function handleDrop(targetId: string) {
    const sourceId = draggingId;
    setDraggingId(null);
    setDropTargetId(null);
    if (!sourceId || sourceId === targetId) return;
    const toIndex = orderableCards(cards).findIndex((card) => card.id === targetId);
    const next = moveCardTo(cards, sourceId, toIndex);
    if (next === cards) return;
    commit(next);
    const card = next.find((candidate) => candidate.id === sourceId);
    setReorderNote(
      `${card?.label ?? "Card"} moved to position ${positionOf(next, sourceId)} of ${
        orderableCards(next).length
      }.`,
    );
  }

  function handleClear() {
    clearIntakeData();
    setCleared(true);
    setConfirmingClear(false);
  }

  return (
    <main id="main" className="aaa-home">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16">
        <span className="aaa-hero-badge" aria-hidden="true">
          <ToolIcon icon="lines" />
        </span>

        <h1 className="aaa-hero-heading">What would you like to do today?</h1>

        <p className="aaa-hero-sub">
          A few guided questions replace the email thread. The system drafts your creative
          brief, flags related activity, and routes it for review.
        </p>

        <ul className="aaa-tool-grid" role="list">
          {cards.map((card) => (
            <ToolCard
              key={card.id}
              card={card}
              position={positionOf(cards, card.id)}
              total={orderable.length}
              armed={armedId === card.id}
              dragging={draggingId !== null}
              isDropTarget={dropTargetId === card.id && draggingId !== card.id}
              refocus={refocus.id === card.id ? refocus.tick : 0}
              onToggleArm={() =>
                setArmedId((current) => (current === card.id ? null : card.id))
              }
              onDisarm={() =>
                setArmedId((current) => (current === card.id ? null : current))
              }
              onMove={(delta) => handleMove(card.id, delta)}
              onDragStart={() => setDraggingId(card.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTargetId(null);
              }}
              onDragEnterCard={() => setDropTargetId(card.id)}
              onDropOnCard={() => handleDrop(card.id)}
              onOpenManager={() => setDialogOpen(true)}
            />
          ))}
        </ul>

        {/* Every reorder, refusal, add, and delete lands here, so the change is not sight-only. */}
        <div className="sr-only" role="status" aria-live="polite">
          {reorderNote}
        </div>

        {/* Load-bearing now that the grip only appears on rollover: this sentence is how someone
            learns the grip exists at all. Do not trim it without restoring the always-on grip. */}
        <p className="aaa-grid-hint">
          Point at a card to show its grip. Drag the grip to move the card, or press it and use
          the arrow keys or the Move buttons.
        </p>

        {loadNote ? <p className="aaa-attention">{loadNote}</p> : null}
        {saveProblem ? <p className="aaa-attention">{saveProblem}</p> : null}

        <Link to="/request" className="aaa-btn aaa-btn-primary mt-10">
          Start Request
        </Link>

        <p className="aaa-home-note">
          Everything you enter stays in this browser on this device. Nothing is sent
          anywhere yet.
        </p>

        <div className="aaa-home-footer">
          <Link to="/settings/questions" className="aaa-link-quiet">
            Manage intake questions
          </Link>
          <span aria-hidden="true">&middot;</span>
          <Link to="/settings/queue" className="aaa-link-quiet">
            Manage the queue
          </Link>
          <span aria-hidden="true">&middot;</span>
          <Link to="/deliverables" className="aaa-link-quiet">
            Request Queue
          </Link>
          <span aria-hidden="true">&middot;</span>
          {confirmingClear ? (
            <span className="aaa-clear-confirm">
              Clear all saved requests and your saved name and email from this browser?
              Request Queue rows are not affected and are cleared from that screen.
              <button type="button" className="aaa-btn-text-danger" onClick={handleClear}>
                Yes, clear it
              </button>
              <button
                type="button"
                className="aaa-btn-text"
                onClick={() => setConfirmingClear(false)}
              >
                Keep it
              </button>
            </span>
          ) : (
            /* Labelled for requests, not "my data": clearIntakeData leaves the Request Queue's
               rows in place, and a broader label would promise more than it delivers. */
            <button
              type="button"
              className="aaa-link-quiet"
              onClick={() => setConfirmingClear(true)}
            >
              Clear my saved requests on this device
            </button>
          )}
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {cleared
            ? "Saved requests and your saved details were cleared from this browser."
            : ""}
        </div>
        {cleared ? (
          <p className="aaa-cleared-note">
            Cleared. Saved requests and your saved details are gone from this browser.
          </p>
        ) : null}
      </div>

      {dialogOpen ? (
        <AddToolsDialog
          cards={cards}
          onAdd={(card) => {
            // Added before the manager, which withManagerLast keeps pinned at the end.
            commit([...cards, card]);
            setReorderNote(`${card.label} added to the dashboard.`);
          }}
          onDelete={(ids) => {
            commit(removeCards(cards, ids));
            setArmedId(null);
          }}
          onReset={() => {
            const next = resetCards();
            setCards(next);
            setArmedId(null);
            setSaveProblem(null);
            setLoadNote(null);
          }}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </main>
  );
}
