/**
 * Brand Integrated Marketing Deep Dive workbook on SharePoint (system of record).
 * External — opening leaves Mission Control.
 */
export const DEEP_DIVE_SHAREPOINT_CALENDAR_URL =
  "https://aaalife.sharepoint.com/:x:/s/BrandIntegratedMarketing/IQDf5u2BAWNdSqq6UneM3YzIAUBLR7H9oMA1rOPSTrekCRc?e=bgDbef";

/**
 * Local stub afternoon windows: start 1:05 PM, nothing after 2:00 PM.
 * First band is 10 minutes; the rest are 15-minute increments through 2:00.
 */
export const SLOT_WINDOWS: ReadonlyArray<{
  hour: number;
  minute: number;
  durationMinutes: number;
}> = [
  { hour: 13, minute: 5, durationMinutes: 10 },
  { hour: 13, minute: 15, durationMinutes: 15 },
  { hour: 13, minute: 30, durationMinutes: 15 },
  { hour: 13, minute: 45, durationMinutes: 15 },
];

/** Typical band length (hint copy). First window is 10 minutes. */
export const SLOT_DURATION_MINUTES = 15;
