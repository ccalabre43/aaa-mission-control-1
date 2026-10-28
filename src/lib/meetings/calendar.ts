/**
 * Deep Dive booking calendar rules: Wednesdays only, in fixed 3-month quarters.
 * Initial quarter: October–December 2026 (matches the SharePoint workbook season).
 */

/** Sunday = 0 … Wednesday = 3 */
export const WEDNESDAY = 3;

/** Local calendar day as `YYYY-MM-DD` (kept here to avoid a fixtures ↔ calendar cycle). */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateInputValue(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export interface QuarterMonth {
  year: number;
  /** 0-based month index (9 = October). */
  month: number;
  label: string;
}

/** First shipping quarter for the Deep Dive page. */
export const INITIAL_QUARTER: readonly QuarterMonth[] = [
  { year: 2026, month: 9, label: "October 2026" },
  { year: 2026, month: 10, label: "November 2026" },
  { year: 2026, month: 11, label: "December 2026" },
] as const;

export function isWednesday(date: Date): boolean {
  return date.getDay() === WEDNESDAY;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** True when the calendar day is before today (local). */
export function isPastDay(date: Date, now = new Date()): boolean {
  return startOfLocalDay(date).getTime() < startOfLocalDay(now).getTime();
}

export function isFutureOrToday(date: Date, now = new Date()): boolean {
  return !isPastDay(date, now);
}

export function wednesdaysInMonth(
  year: number,
  month: number,
): Date[] {
  const days: Date[] = [];
  const cursor = new Date(year, month, 1);
  while (cursor.getMonth() === month) {
    if (cursor.getDay() === WEDNESDAY) {
      days.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Month cells for a Sun–Sat grid (null = padding outside the month). */
export function monthGridCells(
  year: number,
  month: number,
): Array<Date | null> {
  const first = new Date(year, month, 1);
  const startPad = first.getDay(); // Sun = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function quarterContainsYmd(
  ymd: string,
  quarter: readonly QuarterMonth[] = INITIAL_QUARTER,
): boolean {
  const date = parseDateInputValue(ymd);
  if (!date) return false;
  return quarter.some(
    (q) => q.year === date.getFullYear() && q.month === date.getMonth(),
  );
}

export function findQuarterMonth(
  year: number,
  month: number,
  quarter: readonly QuarterMonth[] = INITIAL_QUARTER,
): QuarterMonth | undefined {
  return quarter.find((q) => q.year === year && q.month === month);
}

/**
 * Next bookable Wednesday on or after `now` inside the initial quarter.
 * Falls back to the first future Wednesday in the quarter, then the first Wednesday.
 */
export function defaultBookableWednesday(
  now = new Date(),
  quarter: readonly QuarterMonth[] = INITIAL_QUARTER,
): string {
  const today = startOfLocalDay(now);
  const candidates: Date[] = [];
  for (const q of quarter) {
    for (const wed of wednesdaysInMonth(q.year, q.month)) {
      candidates.push(wed);
    }
  }
  const upcoming = candidates.find((d) => d.getTime() >= today.getTime());
  if (upcoming) return toDateInputValue(upcoming);
  if (candidates[0]) return toDateInputValue(candidates[0]);
  return toDateInputValue(today);
}

export function formatMonthDayYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatWeekdayLong(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
