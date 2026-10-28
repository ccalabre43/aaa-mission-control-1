/**
 * Day-grid Deep Dive slots for `LocalMeetingScheduler`.
 *
 * Open options for the selected date: 1:05–1:15, 1:15–1:30, 1:30–1:45, 1:45–2:00
 * (nothing after 2:00 PM). Booked rows live in localStorage.
 */
import {
  isWednesday,
  parseDateInputValue,
  toDateInputValue,
} from "./calendar";
import { SLOT_WINDOWS } from "./constants";
import type { MeetingSlot } from "./types";

export { parseDateInputValue, toDateInputValue };

const HOST = "Brand Integrated Marketing";

const OLD_FIXTURE_PREFIXES = ["slot-demo-", "slot-1305", "slot-1315", "slot-1330", "slot-1345"];

export function isLegacyFixtureSlotId(id: string): boolean {
  return OLD_FIXTURE_PREFIXES.some(
    (prefix) => id === prefix || id.startsWith(prefix),
  );
}

export function slotIdFor(ymd: string, hour: number, minute: number): string {
  return `slot-${ymd}-${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}`;
}

/**
 * Afternoon open windows on `ymd`: 1:05 PM start through 2:00 PM end.
 * Deep Dive meetings run on Wednesdays only. Past starts on today are omitted.
 */
export function slotsForDay(ymd: string, now = new Date()): MeetingSlot[] {
  const day = parseDateInputValue(ymd);
  if (!day || !isWednesday(day)) return [];

  const todayYmd = toDateInputValue(now);
  const slots: MeetingSlot[] = [];

  for (const window of SLOT_WINDOWS) {
    const start = new Date(day);
    start.setHours(window.hour, window.minute, 0, 0);
    if (ymd === todayYmd && start.getTime() <= now.getTime()) {
      continue;
    }
    slots.push({
      id: slotIdFor(ymd, window.hour, window.minute),
      startsAt: start.toISOString(),
      durationMinutes: window.durationMinutes,
      hostName: HOST,
      title: "Deep Dive",
      status: "open",
    });
  }
  return slots;
}

/** @deprecated Prefer `slotsForDay`. Kept for reset/migration callers that expect a list. */
export function defaultOpenSlots(): MeetingSlot[] {
  return [];
}
