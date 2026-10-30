/**
 * Same-origin Deep Dive proxy client. Vite rewrites `/api/deep-dive` to the local Node stand-in.
 * Never put Graph secrets in the client.
 */

import type {
  BookMeetingInput,
  BookMeetingResult,
  BookMeetingFailure,
  ListSlotsResult,
  MeetingSlot,
  ScheduleCoverage,
} from "./types";

export interface DeepDiveProxyHealth {
  service?: string;
  connected: boolean;
  liveWrite: boolean;
  authMode?: string;
  workbookConfigured?: boolean;
  graphError?: string | null;
  coverage?: string;
}

function apiBase(): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return `${base}/api/deep-dive`;
}

export async function fetchDeepDiveHealth(): Promise<DeepDiveProxyHealth | null> {
  try {
    const res = await fetch(`${apiBase()}/health`, { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json()) as DeepDiveProxyHealth;
  } catch {
    return null;
  }
}

export async function fetchDeepDiveSlots(day: string): Promise<ListSlotsResult | null> {
  try {
    const res = await fetch(
      `${apiBase()}/slots?day=${encodeURIComponent(day)}`,
      { credentials: "same-origin" },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ok?: boolean;
      slots?: MeetingSlot[];
      coverage?: ScheduleCoverage;
    };
    if (!body.ok || !body.slots || !body.coverage) return null;
    return { slots: body.slots, coverage: body.coverage };
  } catch {
    return null;
  }
}

export async function postDeepDiveBook(
  input: BookMeetingInput,
): Promise<BookMeetingResult | BookMeetingFailure | null> {
  try {
    const res = await fetch(`${apiBase()}/book`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, confirmLive: true }),
    });
    const body = (await res.json()) as BookMeetingResult | BookMeetingFailure;
    if (!body || typeof body !== "object" || !("ok" in body)) return null;
    return body;
  } catch {
    return null;
  }
}
