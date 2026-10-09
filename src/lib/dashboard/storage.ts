/**
 * Dashboard card persistence, mirroring src/lib/intake/storage.ts: a primary key plus a backup,
 * quota messaging the user can act on, and a parse that repairs a record rather than rejecting it.
 *
 * The repair discipline matters more here than the data is precious. Losing a card layout is an
 * annoyance, not a lost brief - but a parse that throws on one malformed card would drop the whole
 * dashboard and leave the home screen empty, with no obvious way back. So an unreadable card is
 * skipped, a partially readable one is filled in from the defaults, and an empty result falls back to
 * `defaultCards()` rather than rendering nothing.
 *
 * Not touched by `clearIntakeData`. That function clears requester data - briefs and saved identity.
 * A card layout is a display preference containing no PII, and wiping it would be a surprise to
 * someone who asked to clear their saved requests. Same reasoning as `aaa-intake-queue-config`.
 */
import {
  CARDS_BACKUP_KEY,
  CARDS_STORAGE_KEY,
  MAX_CARD_DESCRIPTION,
  MAX_CARD_LABEL,
  PICKABLE_ICONS,
  defaultCards,
  withManagerLast,
  type CardIcon,
  type CardTint,
  type DashboardCard,
} from "./cards";

export type CardsLoadStatus = "ok" | "default" | "recovered" | "repaired" | "unreadable";

export interface CardsLoadResult {
  cards: DashboardCard[];
  status: CardsLoadStatus;
}

export interface SaveResult {
  ok: boolean;
  reason?: string;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string): SaveResult {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (cause) {
    const quotaHit =
      cause instanceof DOMException &&
      (cause.name === "QuotaExceededError" ||
        cause.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      reason: quotaHit
        ? "This browser's storage is full, so the dashboard layout was not saved. Clearing older saved requests will free up space."
        : "This browser is blocking local storage, so dashboard changes cannot be saved here.",
    };
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const VALID_TINTS: readonly CardTint[] = [
  "aaa-tile-blue",
  "aaa-tile-green",
  "aaa-tile-bronze",
  "aaa-tile-ink",
];

function tint(value: unknown): CardTint {
  const found = VALID_TINTS.find((candidate) => candidate === value);
  return found ?? "aaa-tile-blue";
}

const ALL_ICONS: readonly CardIcon[] = [...PICKABLE_ICONS, "plus"];

function icon(value: unknown): CardIcon {
  const found = ALL_ICONS.find((candidate) => candidate === value);
  return found ?? "lines";
}

/**
 * Repairs one card, or returns null when there is nothing worth keeping.
 *
 * A card with no id and no label is genuinely unrecoverable, because there would be nothing to
 * render and nothing to key a React list by. Everything else has a sane default.
 */
function normalizeCard(value: unknown): DashboardCard | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const label = text(raw.label).trim().slice(0, MAX_CARD_LABEL);
  const id = text(raw.id).trim();
  if (!id && !label) return null;

  const route = text(raw.to).trim();
  return {
    id: id || crypto.randomUUID(),
    label: label || "Untitled card",
    description: text(raw.description).trim().slice(0, MAX_CARD_DESCRIPTION),
    // Only an in-app path survives a reload. Anything else - a bare word, or an http URL from a
    // hand-edited value - is dropped so it cannot become a broken router link or an unvetted
    // outbound destination the app never agreed to carry.
    ...(route.startsWith("/") ? { to: route } : {}),
    tint: tint(raw.tint),
    icon: icon(raw.icon),
    custom: raw.custom === true,
    ...(raw.manager === true ? { manager: true as const } : {}),
  };
}

interface ParseOutcome {
  cards: DashboardCard[];
  /** True when at least one entry was dropped or patched, so the caller can report honestly. */
  repaired: boolean;
}

function parseCards(rawValue: string | null): ParseOutcome | null {
  if (rawValue == null) return null;
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return null;
    const cards: DashboardCard[] = [];
    let repaired = false;
    for (const entry of parsed) {
      const card = normalizeCard(entry);
      if (card) cards.push(card);
      else repaired = true;
    }
    // Duplicate ids would break React keys and make a move ambiguous.
    const seen = new Set<string>();
    const unique = cards.filter((card) => {
      if (seen.has(card.id)) {
        repaired = true;
        return false;
      }
      seen.add(card.id);
      return true;
    });
    return { cards: unique, repaired };
  } catch {
    return null;
  }
}

/**
 * Guarantees a manager card exists.
 *
 * Without this, deleting the manager by hand-editing storage would leave a dashboard with no way to
 * open the dialog and therefore no way to add anything back.
 */
function ensureManager(cards: DashboardCard[]): {
  cards: DashboardCard[];
  added: boolean;
} {
  if (cards.some((card) => card.manager === true)) {
    return { cards: withManagerLast(cards), added: false };
  }
  const manager = defaultCards().find((card) => card.manager === true)!;
  return { cards: withManagerLast([...cards, manager]), added: true };
}

const SHIPPED_CARD_IDS = new Set(["intake", "strategy", "sales", "add"]);

/**
 * Keeps shipped home tiles aligned with `defaultCards()` for label, description, tint, and icon.
 *
 * Layout order and custom cards stay as saved. Non-custom cards with a shipped id are refreshed so
 * Figma copy/icon updates appear without a full dashboard reset.
 */
function syncShippedCardPresentation(cards: DashboardCard[]): {
  cards: DashboardCard[];
  changed: boolean;
} {
  const byId = new Map(defaultCards().map((card) => [card.id, card]));
  let changed = false;
  const next = cards.map((card) => {
    if (card.custom || !SHIPPED_CARD_IDS.has(card.id)) return card;
    const shipped = byId.get(card.id);
    if (!shipped) return card;
    if (
      card.label === shipped.label &&
      card.description === shipped.description &&
      card.icon === shipped.icon &&
      card.tint === shipped.tint
    ) {
      return card;
    }
    changed = true;
    const { to: _prevTo, ...rest } = card;
    return {
      ...rest,
      label: shipped.label,
      description: shipped.description,
      icon: shipped.icon,
      tint: shipped.tint,
      ...(shipped.manager ? { manager: true as const } : {}),
      ...(shipped.to ? { to: shipped.to } : {}),
    };
  });
  return { cards: next, changed };
}

export function loadCards(): CardsLoadResult {
  const raw = readKey(CARDS_STORAGE_KEY);
  const parsed = parseCards(raw);

  if (parsed && parsed.cards.length > 0) {
    const { cards, added } = ensureManager(parsed.cards);
    const synced = syncShippedCardPresentation(cards);
    // Quietly persist Figma presentation updates so they do not look like a parse repair.
    if (synced.changed || added) {
      saveCards(synced.cards);
    }
    return {
      cards: synced.cards,
      status: parsed.repaired || added ? "repaired" : "ok",
    };
  }

  const backup = parseCards(readKey(CARDS_BACKUP_KEY));
  if (backup && backup.cards.length > 0) {
    const { cards } = ensureManager(backup.cards);
    const synced = syncShippedCardPresentation(cards);
    if (synced.changed) {
      saveCards(synced.cards);
    }
    return { cards: synced.cards, status: "recovered" };
  }

  // Never render an empty dashboard. Absent storage is a first visit; unreadable storage is a
  // failure the caller surfaces, but both get a usable grid.
  return { cards: defaultCards(), status: raw == null ? "default" : "unreadable" };
}

export function saveCards(cards: DashboardCard[]): SaveResult {
  const ordered = withManagerLast(cards);
  const payload = JSON.stringify(ordered);
  if (ordered.length > 0) writeKey(CARDS_BACKUP_KEY, payload);
  return writeKey(CARDS_STORAGE_KEY, payload);
}

/** Drops the saved layout so the next load returns `defaultCards()`. */
export function resetCards(): DashboardCard[] {
  try {
    localStorage.removeItem(CARDS_STORAGE_KEY);
    localStorage.removeItem(CARDS_BACKUP_KEY);
  } catch {
    // Ignored on purpose: the caller still gets the defaults to render, and a browser blocking
    // storage is already reported on the next save attempt.
  }
  return defaultCards();
}

/**
 * Plain-language explanation of a non-ok load, or null when there is nothing to say.
 *
 * Every branch names what happened to the user's own data rather than reporting a status code, for
 * the same reason the coverage disclosure states its corpus: a message the user cannot act on is
 * worse than none.
 */
export function cardsLoadMessage(status: CardsLoadStatus): string | null {
  switch (status) {
    case "recovered":
      return "The saved dashboard layout could not be read, so a backup copy was restored.";
    case "repaired":
      return "Part of the saved dashboard layout was unreadable and was skipped. The rest is intact.";
    case "unreadable":
      return "The saved dashboard layout could not be read, so the default cards are shown. Saving now will replace the unreadable copy.";
    default:
      return null;
  }
}
