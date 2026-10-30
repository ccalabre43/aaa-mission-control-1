/**
 * Deep Dive scheduler that prefers the SharePoint Excel proxy when connected.
 * Live PII writes only when the proxy kill switch is on (decision 044 / 046).
 * Falls back to LocalMeetingScheduler when the proxy is down or not configured.
 */
import { LocalMeetingScheduler } from "./LocalMeetingScheduler";
import {
  fetchDeepDiveHealth,
  fetchDeepDiveSlots,
  postDeepDiveBook,
} from "./proxyClient";
import type {
  BookMeetingFailure,
  BookMeetingInput,
  BookMeetingResult,
  ListSlotsResult,
  MeetingScheduler,
} from "./types";

export class SharePointExcelScheduler implements MeetingScheduler {
  private readonly local = new LocalMeetingScheduler();

  async listOpenSlots(day: string): Promise<ListSlotsResult> {
    const health = await fetchDeepDiveHealth();
    if (health?.connected) {
      const remote = await fetchDeepDiveSlots(day);
      if (remote) return remote;
    }
    const local = await this.local.listOpenSlots(day);
    if (health && !health.connected) {
      return {
        ...local,
        coverage: {
          ...local.coverage,
          limitations: [
            ...local.coverage.limitations,
            health.graphError
              ? `Deep Dive proxy unreachable or not connected: ${health.graphError}`
              : "Deep Dive proxy reported not connected to SharePoint Excel.",
          ],
        },
      };
    }
    return local;
  }

  async book(
    input: BookMeetingInput,
  ): Promise<BookMeetingResult | BookMeetingFailure> {
    const health = await fetchDeepDiveHealth();

    if (health?.connected && health.liveWrite) {
      const remote = await postDeepDiveBook(input);
      if (remote) return remote;
      const localCoverage = (await this.local.listOpenSlots(input.day)).coverage;
      return {
        ok: false,
        reason:
          "The SharePoint booking request failed. Nothing was written to Excel. Try again or use the workbook link if the proxy is down.",
        coverage: {
          ...localCoverage,
          scope: "sharepoint-excel",
          limitations: [
            "Live book was attempted via the Deep Dive proxy but did not complete — SharePoint was not updated.",
            ...localCoverage.limitations,
          ],
        },
      };
    }

    const local = await this.local.book(input);
    if (health?.connected && !health.liveWrite) {
      return {
        ...local,
        coverage: {
          ...local.coverage,
          limitations: [
            ...(local.ok ? local.coverage.limitations : local.coverage.limitations),
            "SharePoint is reachable for read, but DEEP_DIVE_LIVE_WRITE is off — this booking stayed on this device only (decision 044/046).",
          ],
        },
      };
    }
    return local;
  }
}
