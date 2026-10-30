export type {
  BookMeetingFailure,
  BookMeetingInput,
  BookMeetingResult,
  DeepDiveAudience,
  ListSlotsResult,
  MeetingScheduler,
  MeetingSlot,
  ScheduleCoverage,
  ScheduleCoverageScope,
  ScheduleCompleteness,
  SlotStatus,
} from "./types";
export {
  describeEmptySlots,
  describeScheduleCoverage,
  localScheduleCoverage,
  sharePointScheduleCoverage,
} from "./coverage";
export { LocalMeetingScheduler } from "./LocalMeetingScheduler";
export { SharePointExcelScheduler } from "./SharePointExcelScheduler";
/** Prefers SharePoint proxy when connected; otherwise local stub (decision 044/046). */
export { meetingScheduler } from "./scheduler";
export {
  fetchDeepDiveHealth,
  fetchDeepDiveSlots,
  postDeepDiveBook,
  type DeepDiveProxyHealth,
} from "./proxyClient";
export {
  MEETING_SLOTS_BACKUP_KEY,
  MEETING_SLOTS_KEY,
  loadSlots,
  resetSlots,
  saveSlots,
} from "./storage";
export {
  defaultOpenSlots,
  isLegacyFixtureSlotId,
  slotIdFor,
  slotsForDay,
} from "./fixtures";
export {
  defaultBookableWednesday,
  findQuarterMonth,
  formatMonthDayYear,
  formatWeekdayLong,
  INITIAL_QUARTER,
  isFutureOrToday,
  isPastDay,
  isWednesday,
  monthGridCells,
  parseDateInputValue,
  quarterContainsYmd,
  toDateInputValue,
  wednesdaysInMonth,
  WEDNESDAY,
  type QuarterMonth,
} from "./calendar";
export {
  DEEP_DIVE_SHAREPOINT_CALENDAR_URL,
  SLOT_DURATION_MINUTES,
  SLOT_WINDOWS,
} from "./constants";
