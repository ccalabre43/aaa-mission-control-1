/**
 * Default Deep Dive scheduler: SharePoint Excel proxy with local fallback.
 */
import { SharePointExcelScheduler } from "./SharePointExcelScheduler";
import type { MeetingScheduler } from "./types";

export const meetingScheduler: MeetingScheduler = new SharePointExcelScheduler();
