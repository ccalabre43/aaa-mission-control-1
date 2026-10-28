/**
 * Deep Dive meeting scheduling port.
 *
 * Excel on SharePoint is the system of record. Mission Control is the presentation layer. Live
 * Graph/Excel calls stay behind a server proxy after Vendor Management approves Composio (decision
 * 044). Sprint 1 ships `LocalMeetingScheduler` only — same adapter pattern as Workfront and
 * `RelatedWorkMatcher`.
 */

/** How complete the slot corpus is for guardrail 7 disclosures. */
export type ScheduleCoverageScope = "local-device" | "sharepoint-excel";

export type ScheduleCompleteness = "partial" | "full";

export interface ScheduleCoverage {
  scope: ScheduleCoverageScope;
  completeness: ScheduleCompleteness;
  corpusSize: number;
  sources: Array<{ label: string; count: number }>;
  limitations: string[];
  searchedAt: string;
}

export type SlotStatus = "open" | "booked";

export type DeepDiveAudience = "Full Team" | "Leadership";

export interface MeetingSlot {
  id: string;
  startsAt: string;
  durationMinutes: number;
  hostName: string;
  title: string;
  status: SlotStatus;
  /** Present when booked. PII — local stub only until privacy review for network write. */
  requesterName?: string;
  requesterEmail?: string;
  notes?: string;
  audience?: DeepDiveAudience;
  bookedAt?: string;
}

export interface BookMeetingInput {
  /** Local calendar day `YYYY-MM-DD` the slot grid was built for. */
  day: string;
  slotId: string;
  requesterName: string;
  requesterEmail: string;
  audience: DeepDiveAudience;
  title?: string;
  notes?: string;
}

export interface ListSlotsResult {
  slots: MeetingSlot[];
  coverage: ScheduleCoverage;
}

export interface BookMeetingResult {
  ok: true;
  slot: MeetingSlot;
  coverage: ScheduleCoverage;
}

export interface BookMeetingFailure {
  ok: false;
  reason: string;
  coverage: ScheduleCoverage;
}

export interface MeetingScheduler {
  /** Open 15-minute windows for a local `YYYY-MM-DD` day (stub corpus). */
  listOpenSlots(day: string): Promise<ListSlotsResult>;
  book(input: BookMeetingInput): Promise<BookMeetingResult | BookMeetingFailure>;
}
