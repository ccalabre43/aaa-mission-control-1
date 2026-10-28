/**
 * Honest coverage copy for Deep Dive availability (guardrail 7).
 */
import type { MeetingSlot, ScheduleCoverage } from "./types";
import { SLOT_DURATION_MINUTES } from "./constants";

export function localScheduleCoverage(
  slots: MeetingSlot[],
  dayLabel?: string,
): ScheduleCoverage {
  const open = slots.filter((slot) => slot.status === "open").length;
  const dayBit = dayLabel ? ` for ${dayLabel}` : "";

  return {
    scope: "local-device",
    completeness: "partial",
    corpusSize: slots.length,
    sources: [
      {
        label: `Local Deep Dive stub${dayBit} (${SLOT_DURATION_MINUTES}-minute windows)`,
        count: slots.length,
      },
    ],
    limitations: [
      `Searched ${slots.length} local demo slots (${open} open)${dayBit}. The Brand Integrated Marketing SharePoint workbook was not queried — live Excel requires Vendor Management approval (decision 044).`,
    ],
    searchedAt: new Date().toISOString(),
  };
}

export function describeScheduleCoverage(coverage: ScheduleCoverage): string {
  const sourceLine = coverage.sources
    .map((source) => `${source.label} (${source.count})`)
    .join("; ");
  const limitLine = coverage.limitations.join(" ");
  return `${sourceLine}. ${limitLine}`.trim();
}

export function describeEmptySlots(coverage: ScheduleCoverage): string {
  return `No open Deep Dive slots in the corpus that was searched. ${describeScheduleCoverage(coverage)}`;
}
