/**
 * The home dashboard's cards, as data rather than a hardcoded array.
 *
 * These were a `const TOOLS` inside `HomeView`. Moving them here is what lets an admin add, remove,
 * and reorder them, and it keeps the shipped four recoverable through `defaultCards()` in the same
 * way `resetRegistry` recovers the default questions.
 *
 * A custom card added here carries no destination. It renders as a solid idle tile (same chrome as
 * Deep Dive) until a route is wired. Matching Concept v1 node 369-4361.
 */

/**
 * Tile fills. `aaa-tile-ink` is reserved for Add Tools. Green/bronze remain for stored custom cards;
 * the Concept v1 picker offers charcoal / blue / red / slate (decision 043 for red tile fill).
 */
export type CardTint =
  | "aaa-tile-blue"
  | "aaa-tile-green"
  | "aaa-tile-bronze"
  | "aaa-tile-ink"
  | "aaa-tile-charcoal"
  | "aaa-tile-slate"
  | "aaa-tile-red";

export type CardIcon =
  | "lines"
  | "document"
  | "window"
  | "search"
  | "plus"
  | "palette"
  | "chat"
  | "frame"
  | "chart"
  | "briefcase"
  | "star";

/** Concept v1 Add a tool picker (node 369-4561). */
export const PICKABLE_ICONS: readonly CardIcon[] = [
  "palette",
  "chart",
  "briefcase",
  "star",
];

/**
 * Concept v1 color swatches. Ink is withheld so a custom card cannot impersonate Add Tools.
 * Red is a tile fill behind a white glyph only (decision 043), not a primary CTA.
 */
export const PICKABLE_TINTS: ReadonlyArray<{ tint: CardTint; label: string }> = [
  { tint: "aaa-tile-charcoal", label: "Charcoal" },
  { tint: "aaa-tile-blue", label: "Blue" },
  { tint: "aaa-tile-red", label: "Red" },
  { tint: "aaa-tile-slate", label: "Slate" },
];

export interface DashboardCard {
  id: string;
  label: string;
  description: string;
  /** An internal route. Absent: solid idle tile (no navigation). */
  to?: string;
  tint: CardTint;
  icon: CardIcon;
  /** False for the four shipped cards, true for anything added through the dialog. */
  custom: boolean;
  /**
   * The control that manages the grid. Exactly one card carries this, it is pinned last, and it is
   * excluded from reordering and deletion - a control that can delete itself leaves the admin with
   * no way back.
   */
  manager?: true;
}

export const CARDS_STORAGE_KEY = "aaa-dashboard-cards";
export const CARDS_BACKUP_KEY = "aaa-dashboard-cards-backup";

export const MAX_CARD_LABEL = 40;
export const MAX_CARD_DESCRIPTION = 80;

/**
 * The four cards the app ships with (Concept v1 node 369-4361).
 *
 * Deep Dive routes to the local MeetingScheduler stub (`/deep-dive`). Live SharePoint Excel is
 * gated on Vendor Management (decision 044).
 */
export function defaultCards(): DashboardCard[] {
  return [
    {
      id: "intake",
      label: "Marketing Request",
      description: "Tell us what you need",
      to: "/request",
      tint: "aaa-tile-blue",
      icon: "palette",
      custom: false,
    },
    {
      id: "strategy",
      label: "Executive View",
      description: "Team Activity",
      to: "/deliverables?tab=executive",
      tint: "aaa-tile-blue",
      icon: "frame",
      custom: false,
    },
    {
      id: "sales",
      label: "Deep Dive",
      description: "Schedule now",
      to: "/deep-dive",
      tint: "aaa-tile-bronze",
      icon: "search",
      custom: false,
    },
    {
      id: "add",
      label: "Add Tools",
      description: "Pin something new",
      tint: "aaa-tile-ink",
      icon: "plus",
      custom: false,
      manager: true,
    },
  ];
}

export function isManager(card: DashboardCard): boolean {
  return card.manager === true;
}

/**
 * Whether a card can be removed or moved.
 *
 * Every card except the manager qualifies, including Intake Form. That is safe because the
 * "Start Request" button below the grid and the footer links are unconditional, so removing the
 * Intake Form tile cannot make the intake flow unreachable, and `defaultCards()` brings it back.
 */
export function isEditable(card: DashboardCard): boolean {
  return !isManager(card);
}

/** The cards that participate in ordering, which is everything the manager is not. */
export function orderableCards(cards: DashboardCard[]): DashboardCard[] {
  return cards.filter(isEditable);
}

/**
 * The manager pinned last, whatever order the stored list is in.
 *
 * Called on every read rather than enforced only on write, so a hand-edited `localStorage` value or
 * an older saved list still renders with `Add Tools` in its terminal position.
 */
export function withManagerLast(cards: DashboardCard[]): DashboardCard[] {
  const managers = cards.filter(isManager);
  return [...cards.filter(isEditable), ...managers];
}

export interface CardProblem {
  field: "label" | "description";
  message: string;
}

/** Checked before a card is added, so the dialog can refuse with a reason rather than saving junk. */
export function validateDraft(
  draft: Pick<DashboardCard, "label" | "description">,
): CardProblem[] {
  const problems: CardProblem[] = [];
  if (!draft.label.trim()) {
    problems.push({ field: "label", message: "Give the card a title." });
  } else if (draft.label.trim().length > MAX_CARD_LABEL) {
    problems.push({
      field: "label",
      message: `Keep the title to ${MAX_CARD_LABEL} characters or fewer so it fits the tile.`,
    });
  }
  if (draft.description.trim().length > MAX_CARD_DESCRIPTION) {
    problems.push({
      field: "description",
      message: `Keep the description to ${MAX_CARD_DESCRIPTION} characters or fewer.`,
    });
  }
  return problems;
}

export function createCard(
  partial: Partial<DashboardCard> = {},
): DashboardCard {
  return {
    id: crypto.randomUUID(),
    label: "",
    description: "",
    tint: "aaa-tile-blue",
    icon: "lines",
    custom: true,
    ...partial,
  };
}

/**
 * Moves a card by `delta` within the orderable cards, then re-pins the manager.
 *
 * Returns the same array identity when the move is impossible, so a caller can tell a refused move
 * from an applied one and avoid announcing a change that did not happen.
 */
export function moveCard(
  cards: DashboardCard[],
  id: string,
  delta: number,
): DashboardCard[] {
  const orderable = orderableCards(cards);
  const from = orderable.findIndex((card) => card.id === id);
  if (from < 0) return cards;
  const to = from + delta;
  if (to < 0 || to >= orderable.length) return cards;
  const next = [...orderable];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return withManagerLast([...next, ...cards.filter(isManager)]);
}

/** Drag drops onto a position rather than stepping, so it needs an absolute move. */
export function moveCardTo(
  cards: DashboardCard[],
  id: string,
  toIndex: number,
): DashboardCard[] {
  const orderable = orderableCards(cards);
  const from = orderable.findIndex((card) => card.id === id);
  if (from < 0 || toIndex < 0 || toIndex >= orderable.length || from === toIndex) {
    return cards;
  }
  const next = [...orderable];
  const [moved] = next.splice(from, 1);
  next.splice(toIndex, 0, moved);
  return withManagerLast([...next, ...cards.filter(isManager)]);
}

export function removeCards(
  cards: DashboardCard[],
  ids: ReadonlySet<string>,
): DashboardCard[] {
  return withManagerLast(
    cards.filter((card) => isManager(card) || !ids.has(card.id)),
  );
}

/** 1-based position among the orderable cards, for the live-region announcement. */
export function positionOf(cards: DashboardCard[], id: string): number {
  return orderableCards(cards).findIndex((card) => card.id === id) + 1;
}
