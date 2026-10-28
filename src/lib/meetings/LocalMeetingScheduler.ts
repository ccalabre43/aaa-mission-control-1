/**
 * Sprint-1 Deep Dive scheduler: per-day 15-minute grid + localStorage bookings only.
 */
import { localScheduleCoverage } from "./coverage";
import { slotsForDay } from "./fixtures";
import { loadSlots, saveSlots } from "./storage";
import type {
  BookMeetingFailure,
  BookMeetingInput,
  BookMeetingResult,
  ListSlotsResult,
  MeetingScheduler,
  MeetingSlot,
} from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBookInput(input: BookMeetingInput): string | null {
  const name = input.requesterName.trim();
  const email = input.requesterEmail.trim();
  if (!name) return "Enter your name so the host knows who booked the slot.";
  if (!email) return "Enter your work email so the booking can be confirmed.";
  if (!EMAIL_PATTERN.test(email)) {
    return "That email does not look valid. Use your @aaalife.com address when possible.";
  }
  if (!input.slotId.trim()) return "Choose an open slot before booking.";
  if (!input.day?.trim()) return "Choose a date before booking.";
  if (input.audience !== "Full Team" && input.audience !== "Leadership") {
    return "Choose an audience: Full Team or Leadership.";
  }
  return null;
}

function dayGridWithBookings(day: string): MeetingSlot[] {
  const bookedIds = new Set(loadSlots().slots.map((slot) => slot.id));
  return slotsForDay(day).map((slot) =>
    bookedIds.has(slot.id) ? { ...slot, status: "booked" as const } : slot,
  );
}

export class LocalMeetingScheduler implements MeetingScheduler {
  async listOpenSlots(day: string): Promise<ListSlotsResult> {
    const grid = dayGridWithBookings(day);
    return {
      slots: grid.filter((slot) => slot.status === "open"),
      coverage: localScheduleCoverage(grid, day),
    };
  }

  async book(
    input: BookMeetingInput,
  ): Promise<BookMeetingResult | BookMeetingFailure> {
    const day = input.day.trim();
    const grid = dayGridWithBookings(day);
    const coverage = localScheduleCoverage(grid, day);
    const { slots: bookings } = loadSlots();

    const validation = validateBookInput(input);
    if (validation) {
      return { ok: false, reason: validation, coverage };
    }

    if (bookings.some((slot) => slot.id === input.slotId)) {
      return {
        ok: false,
        reason: "That slot is already booked on this device. Choose another open time.",
        coverage,
      };
    }

    const current = grid.find(
      (slot) => slot.id === input.slotId && slot.status === "open",
    );
    if (!current) {
      return {
        ok: false,
        reason: "That time is not available on the selected date. Pick another slot.",
        coverage,
      };
    }

    const booked: MeetingSlot = {
      ...current,
      status: "booked",
      requesterName: input.requesterName.trim(),
      requesterEmail: input.requesterEmail.trim(),
      title: input.title?.trim() || current.title,
      notes: input.notes?.trim() || undefined,
      audience: input.audience,
      bookedAt: new Date().toISOString(),
    };

    const next = [...bookings, booked];
    const saved = saveSlots(next);
    if (!saved.ok) {
      return {
        ok: false,
        reason: saved.reason ?? "The booking could not be saved on this device.",
        coverage,
      };
    }

    const after = dayGridWithBookings(day);
    return {
      ok: true,
      slot: booked,
      coverage: localScheduleCoverage(after, day),
    };
  }
}

export const meetingScheduler: MeetingScheduler = new LocalMeetingScheduler();
