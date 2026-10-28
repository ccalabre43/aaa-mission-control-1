/**
 * Local Deep Dive bookings. Primary + backup, quota messaging, repair-not-reject.
 * Only booked rows are persisted; open slots are generated per day.
 */
import type { DeepDiveAudience, MeetingSlot, SlotStatus } from "./types";

export const MEETING_SLOTS_KEY = "aaa-deep-dive-slots";
export const MEETING_SLOTS_BACKUP_KEY = "aaa-deep-dive-slots-backup";

export type SlotsLoadStatus = "ok" | "default" | "recovered" | "repaired" | "unreadable";

export interface SlotsLoadResult {
  /** Booked slots only. */
  slots: MeetingSlot[];
  status: SlotsLoadStatus;
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
        ? "This browser's storage is full, so the Deep Dive booking was not saved."
        : "This browser is blocking local storage, so Deep Dive bookings cannot be saved here.",
    };
  }
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function status(value: unknown): SlotStatus {
  return value === "booked" ? "booked" : "open";
}

function audience(value: unknown): DeepDiveAudience | undefined {
  return value === "Full Team" || value === "Leadership" ? value : undefined;
}

function normalizeSlot(value: unknown): MeetingSlot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id).trim();
  const startsAt = text(raw.startsAt).trim();
  if (!id || !startsAt) return null;
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) return null;

  const duration = Number(raw.durationMinutes);
  return {
    id,
    startsAt: parsed.toISOString(),
    durationMinutes:
      Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 15,
    hostName: text(raw.hostName, "Brand Integrated Marketing").trim() || "Brand Integrated Marketing",
    title: text(raw.title, "Deep Dive").trim() || "Deep Dive",
    status: status(raw.status),
    ...(text(raw.requesterName).trim()
      ? { requesterName: text(raw.requesterName).trim() }
      : {}),
    ...(text(raw.requesterEmail).trim()
      ? { requesterEmail: text(raw.requesterEmail).trim() }
      : {}),
    ...(text(raw.notes).trim() ? { notes: text(raw.notes).trim() } : {}),
    ...(audience(raw.audience) ? { audience: audience(raw.audience) } : {}),
    ...(text(raw.bookedAt).trim() ? { bookedAt: text(raw.bookedAt).trim() } : {}),
  };
}

function parseSlots(rawValue: string | null): {
  slots: MeetingSlot[];
  repaired: boolean;
} | null {
  if (rawValue == null) return null;
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return null;
    const slots: MeetingSlot[] = [];
    let repaired = false;
    for (const entry of parsed) {
      const slot = normalizeSlot(entry);
      if (slot) slots.push(slot);
      else repaired = true;
    }
    return { slots, repaired };
  } catch {
    return null;
  }
}

/** Keep booked rows; drop open fixture seeds from earlier stub versions. */
function bookingsOnly(slots: MeetingSlot[]): {
  slots: MeetingSlot[];
  changed: boolean;
} {
  const next = slots.filter((slot) => slot.status === "booked");
  return {
    slots: next,
    changed: next.length !== slots.length,
  };
}

export function loadSlots(): SlotsLoadResult {
  const raw = readKey(MEETING_SLOTS_KEY);
  const parsed = parseSlots(raw);
  if (parsed) {
    const { slots, changed } = bookingsOnly(parsed.slots);
    if (changed) saveSlots(slots);
    return {
      slots,
      status: parsed.repaired || changed ? "repaired" : "ok",
    };
  }

  const backup = parseSlots(readKey(MEETING_SLOTS_BACKUP_KEY));
  if (backup) {
    const { slots, changed } = bookingsOnly(backup.slots);
    if (changed) saveSlots(slots);
    return { slots, status: "recovered" };
  }

  return {
    slots: [],
    status: raw == null ? "default" : "unreadable",
  };
}

export function saveSlots(slots: MeetingSlot[]): SaveResult {
  const booked = slots.filter((slot) => slot.status === "booked");
  const payload = JSON.stringify(booked);
  if (booked.length > 0) writeKey(MEETING_SLOTS_BACKUP_KEY, payload);
  else {
    try {
      localStorage.removeItem(MEETING_SLOTS_BACKUP_KEY);
    } catch {
      // ignore
    }
  }
  return writeKey(MEETING_SLOTS_KEY, payload);
}

/** Clears bookings on this device. */
export function resetSlots(): MeetingSlot[] {
  try {
    localStorage.removeItem(MEETING_SLOTS_KEY);
    localStorage.removeItem(MEETING_SLOTS_BACKUP_KEY);
  } catch {
    // Caller still receives an empty list.
  }
  saveSlots([]);
  return [];
}
