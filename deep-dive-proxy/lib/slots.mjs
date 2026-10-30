/**
 * Map SharePoint Excel used-range grids to Deep Dive MeetingSlot shapes.
 *
 * Provisional header map (replace when Composio discovery confirms columns —
 * docs/knowledge/deep-dive-excel.md). Case-insensitive header match.
 */

const HEADER_ALIASES = {
  date: ["date", "day"],
  start: ["start", "starts", "start time", "time"],
  duration: ["duration", "duration minutes", "mins", "minutes"],
  host: ["host", "facilitator", "host name"],
  title: ["title", "topic", "subject"],
  status: ["status", "state"],
  requesterName: ["requested by", "requester", "name", "entered by"],
  requesterEmail: ["email", "requester email", "work email"],
  notes: ["notes", "note", "comments"],
  audience: ["audience"],
};

/** Local stub windows mirrored from src/lib/meetings/constants.ts */
export const SLOT_WINDOWS = [
  { hour: 13, minute: 5, durationMinutes: 10 },
  { hour: 13, minute: 15, durationMinutes: 15 },
  { hour: 13, minute: 30, durationMinutes: 15 },
  { hour: 13, minute: 45, durationMinutes: 15 },
];

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * @param {unknown[][]} values
 * @returns {{ headers: Record<string, number>; rows: unknown[][]; headerRowIndex: number } | null}
 */
export function parseHeaderMap(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const headerRowIndex = 0;
  const headerCells = values[headerRowIndex] || [];
  const headers = {};
  for (let col = 0; col < headerCells.length; col += 1) {
    const label = normalizeHeader(headerCells[col]);
    if (!label) continue;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(label) && headers[field] == null) {
        headers[field] = col;
      }
    }
  }
  if (headers.date == null && headers.start == null) return null;
  return {
    headers,
    rows: values.slice(headerRowIndex + 1),
    headerRowIndex,
  };
}

function cell(row, headers, field) {
  const idx = headers[field];
  if (idx == null) return "";
  const raw = row[idx];
  if (raw == null) return "";
  return String(raw).trim();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Build ISO start from a local calendar day + wall-clock hour/minute (America/Detroit not forced;
 * uses local process TZ — operators should run proxy in US/Eastern when possible).
 */
export function startsAtIso(dayYmd, hour, minute) {
  const [y, m, d] = dayYmd.split("-").map(Number);
  const date = new Date(y, m - 1, d, hour, minute, 0, 0);
  return date.toISOString();
}

export function slotIdFor(dayYmd, hour, minute) {
  return `dd-${dayYmd}-${pad2(hour)}${pad2(minute)}`;
}

/**
 * Open grid for a day (same shape as Mission Control fixtures).
 * @param {string} dayYmd
 */
export function openGridForDay(dayYmd) {
  return SLOT_WINDOWS.map((window) => ({
    id: slotIdFor(dayYmd, window.hour, window.minute),
    startsAt: startsAtIso(dayYmd, window.hour, window.minute),
    durationMinutes: window.durationMinutes,
    hostName: "Brand Integrated Marketing",
    title: "Deep Dive",
    status: "open",
  }));
}

function dayMatches(cellValue, dayYmd) {
  const raw = String(cellValue ?? "").trim();
  if (!raw) return false;
  if (raw.startsWith(dayYmd)) return true;
  // Excel serial date as number string
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 20000 && asNum < 80000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + asNum * 86400000;
    const dt = new Date(ms);
    const ymd = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    return ymd === dayYmd;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const ymd = `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
    return ymd === dayYmd;
  }
  return false;
}

function statusIsBooked(value) {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "booked" || s === "taken" || s === "closed" || s === "confirmed";
}

/**
 * Merge sheet bookings for `dayYmd` onto the open grid.
 * @param {string} dayYmd
 * @param {unknown[][]} values
 */
export function slotsFromUsedRange(dayYmd, values) {
  const grid = openGridForDay(dayYmd);
  const parsed = parseHeaderMap(values);
  if (!parsed) {
    return {
      slots: grid,
      coverageNote:
        "Worksheet headers did not match the provisional Deep Dive column map; returned local open grid only.",
      bookedFromSheet: 0,
    };
  }

  const { headers, rows } = parsed;
  const bookedIds = new Set();
  let bookedFromSheet = 0;

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const dateCell = cell(row, headers, "date");
    const startCell = cell(row, headers, "start");
    if (dateCell && !dayMatches(dateCell, dayYmd)) continue;
    // If only a start datetime embeds the day
    if (!dateCell && startCell && !dayMatches(startCell, dayYmd)) continue;

    const status = cell(row, headers, "status");
    if (status && !statusIsBooked(status) && status.toLowerCase() !== "open") {
      // Unknown status — treat non-open as booked when requester present
      if (!cell(row, headers, "requesterName") && !cell(row, headers, "requesterEmail")) {
        continue;
      }
    }

    let hour = null;
    let minute = null;
    const startParsed = new Date(startCell || dateCell);
    if (!Number.isNaN(startParsed.getTime())) {
      hour = startParsed.getHours();
      minute = startParsed.getMinutes();
    } else {
      const hm = String(startCell).match(/(\d{1,2}):(\d{2})/);
      if (hm) {
        hour = Number(hm[1]);
        minute = Number(hm[2]);
        if (/pm/i.test(startCell) && hour < 12) hour += 12;
      }
    }
    if (hour == null || minute == null) continue;

    const id = slotIdFor(dayYmd, hour, minute);
    bookedIds.add(id);
    bookedFromSheet += 1;
  }

  const slots = grid.map((slot) =>
    bookedIds.has(slot.id) ? { ...slot, status: "booked" } : slot,
  );

  return {
    slots,
    coverageNote: `Merged ${bookedFromSheet} sheet row(s) for ${dayYmd} onto the Deep Dive open grid.`,
    bookedFromSheet,
  };
}

/**
 * Find next empty row index (1-based Excel) for append.
 * @param {unknown[][]} values
 */
export function nextAppendRow(values) {
  if (!Array.isArray(values) || values.length === 0) return 2;
  let last = 1;
  for (let i = 0; i < values.length; i += 1) {
    const row = values[i];
    if (Array.isArray(row) && row.some((c) => String(c ?? "").trim() !== "")) {
      last = i + 1;
    }
  }
  return last + 1;
}

/**
 * Build a provisional append row values array aligned to header aliases.
 * @param {unknown[][]} values
 * @param {object} booking
 */
export function buildAppendValues(values, booking) {
  const parsed = parseHeaderMap(values);
  const width = Math.max(
    ...(values || []).map((r) => (Array.isArray(r) ? r.length : 0)),
    9,
  );
  const row = Array.from({ length: width }, () => "");
  if (!parsed) {
    // A..I provisional: Date, Start, Duration, Host, Topic, Status, Requested by, Email, Notes
    row[0] = booking.day;
    row[1] = booking.startsAt;
    row[2] = booking.durationMinutes;
    row[3] = booking.hostName || "Brand Integrated Marketing";
    row[4] = booking.title || "Deep Dive";
    row[5] = "booked";
    row[6] = booking.requesterName;
    row[7] = booking.requesterEmail;
    row[8] = [booking.audience, booking.notes].filter(Boolean).join(" · ");
    return { row, addressStartCol: "A", colCount: 9 };
  }

  const set = (field, value) => {
    const idx = parsed.headers[field];
    if (idx != null) row[idx] = value;
  };
  set("date", booking.day);
  set("start", booking.startsAt);
  set("duration", booking.durationMinutes);
  set("host", booking.hostName || "Brand Integrated Marketing");
  set("title", booking.title || "Deep Dive");
  set("status", "booked");
  set("requesterName", booking.requesterName);
  set("requesterEmail", booking.requesterEmail);
  set("notes", [booking.audience, booking.notes].filter(Boolean).join(" · "));
  set("audience", booking.audience || "");

  const colCount = row.length;
  return { row, addressStartCol: "A", colCount };
}

export function colLetter(index0) {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
