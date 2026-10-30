#!/usr/bin/env node
/**
 * Local Deep Dive SharePoint Excel proxy (health, slots, book).
 *
 * Secrets: ../.env.deep-dive.local (gitignored). Never logs token/secret values.
 *
 *   npm run deep-dive:proxy
 *   curl -sS http://127.0.0.1:8788/health
 */
import { createServer } from "node:http";
import { liveWriteEnabled, mergeEnv } from "./lib/env.mjs";
import {
  closeSession,
  createSession,
  getUsedRange,
  resolveAccessToken,
  updateRange,
  worksheetId,
} from "./lib/graph.mjs";
import {
  buildAppendValues,
  colLetter,
  nextAppendRow,
  openGridForDay,
  slotIdFor,
  slotsFromUsedRange,
  SLOT_WINDOWS,
  startsAtIso,
} from "./lib/slots.mjs";

const env = mergeEnv();
const PORT = Number(env.DEEP_DIVE_PROXY_PORT || 8788);
const once = process.argv.includes("--once");

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Request body must be JSON."));
      }
    });
    req.on("error", reject);
  });
}

function workbookConfigured(e) {
  return Boolean((e.GRAPH_SITE_ID || "").trim() && (e.GRAPH_ITEM_ID || "").trim());
}

async function buildHealth() {
  const liveWrite = liveWriteEnabled(env);
  const configured = workbookConfigured(env);
  const auth = await resolveAccessToken(env);
  let connected = false;
  let graphError = auth.error || null;

  if (auth.token && configured) {
    const probe = await getUsedRange(env, auth.token);
    connected = probe.ok;
    if (!probe.ok) {
      graphError =
        probe.body?.error?.message ||
        probe.body?.error ||
        `Graph usedRange HTTP ${probe.status}`;
    }
  } else if (!configured) {
    graphError =
      graphError ||
      "GRAPH_SITE_ID / GRAPH_ITEM_ID not set — finish Composio discovery and copy ids into .env.deep-dive.local.";
  }

  return {
    statusCode: 200,
    body: {
      service: "deep-dive-proxy",
      connected,
      liveWrite,
      authMode: auth.mode,
      worksheetId: worksheetId(env),
      workbookConfigured: configured,
      graphError: connected ? null : graphError,
      coverage:
        "Mission Control Deep Dive Excel proxy. Live writes require DEEP_DIVE_LIVE_WRITE=1 and Vendor Management clearance (decision 044/046). Composio is Cursor discovery only — not used at runtime.",
    },
  };
}

async function handleHealth(_req, res) {
  const result = await buildHealth();
  sendJson(res, result.statusCode, result.body);
}

async function handleSlots(req, res, url) {
  const day = (url.searchParams.get("day") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    sendJson(res, 400, { error: "Query day=YYYY-MM-DD is required." });
    return;
  }

  const auth = await resolveAccessToken(env);
  const configured = workbookConfigured(env);

  if (!auth.token || !configured) {
    const grid = openGridForDay(day);
    sendJson(res, 200, {
      ok: true,
      source: "local-fallback",
      slots: grid.filter((s) => s.status === "open"),
      allSlots: grid,
      coverage: {
        scope: "local-device",
        completeness: "partial",
        corpusSize: grid.length,
        sources: [{ label: "Proxy local open grid (SharePoint not connected)", count: grid.length }],
        limitations: [
          auth.error ||
            "SharePoint workbook ids or Graph token missing. Returning local open grid only — not the Brand Integrated Marketing workbook.",
        ],
        searchedAt: new Date().toISOString(),
      },
    });
    return;
  }

  const used = await getUsedRange(env, auth.token);
  if (!used.ok) {
    sendJson(res, 502, {
      ok: false,
      error:
        used.body?.error?.message ||
        used.body?.error ||
        `Graph usedRange failed (${used.status})`,
    });
    return;
  }

  const values = used.body?.values || [];
  const mapped = slotsFromUsedRange(day, values);
  const open = mapped.slots.filter((s) => s.status === "open");
  sendJson(res, 200, {
    ok: true,
    source: "sharepoint-excel",
    slots: open,
    allSlots: mapped.slots,
    coverage: {
      scope: "sharepoint-excel",
      completeness: "partial",
      corpusSize: mapped.slots.length,
      sources: [
        {
          label: `SharePoint Excel worksheet ${worksheetId(env)}`,
          count: mapped.slots.length,
        },
      ],
      limitations: [
        mapped.coverageNote,
        "Corpus is this workbook only — not organization-wide calendars.",
      ],
      searchedAt: new Date().toISOString(),
    },
  });
}

function parseSlotClock(slotId, day) {
  const match = String(slotId).match(/^dd-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})$/);
  if (!match) return null;
  if (match[1] !== day) return null;
  return { hour: Number(match[2]), minute: Number(match[3]) };
}

async function handleBook(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    sendJson(res, 400, { ok: false, reason: err.message });
    return;
  }

  if (!liveWriteEnabled(env)) {
    sendJson(res, 403, {
      ok: false,
      reason:
        "Live Deep Dive write is off. Set DEEP_DIVE_LIVE_WRITE=1 on the proxy only after Vendor Management and privacy clear PII writes to SharePoint (decision 044/046).",
    });
    return;
  }

  if (body.confirmLive !== true) {
    sendJson(res, 400, {
      ok: false,
      reason: "confirmLive: true is required for a live SharePoint booking.",
    });
    return;
  }

  const day = String(body.day || "").trim();
  const slotId = String(body.slotId || "").trim();
  const requesterName = String(body.requesterName || "").trim();
  const requesterEmail = String(body.requesterEmail || "").trim();
  const audience = String(body.audience || "").trim();
  const title = String(body.title || "").trim();
  const notes = String(body.notes || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !slotId || !requesterName || !requesterEmail) {
    sendJson(res, 400, {
      ok: false,
      reason: "day, slotId, requesterName, and requesterEmail are required.",
    });
    return;
  }

  const clock = parseSlotClock(slotId, day);
  if (!clock) {
    sendJson(res, 400, { ok: false, reason: "slotId is not a Deep Dive slot for that day." });
    return;
  }

  const window = SLOT_WINDOWS.find(
    (w) => w.hour === clock.hour && w.minute === clock.minute,
  );
  if (!window) {
    sendJson(res, 400, { ok: false, reason: "That clock time is outside Deep Dive windows." });
    return;
  }

  const auth = await resolveAccessToken(env);
  if (!auth.token || !workbookConfigured(env)) {
    sendJson(res, 503, {
      ok: false,
      reason: auth.error || "SharePoint workbook is not configured on the proxy.",
    });
    return;
  }

  const sessionRes = await createSession(env, auth.token);
  if (!sessionRes.ok || !sessionRes.body?.id) {
    sendJson(res, 502, {
      ok: false,
      reason:
        sessionRes.body?.error?.message ||
        sessionRes.body?.error ||
        `createSession failed (${sessionRes.status})`,
    });
    return;
  }
  const sessionId = sessionRes.body.id;

  try {
    const used = await getUsedRange(env, auth.token, sessionId);
    if (!used.ok) {
      sendJson(res, 502, {
        ok: false,
        reason:
          used.body?.error?.message ||
          used.body?.error ||
          `usedRange failed (${used.status})`,
      });
      return;
    }

    const values = used.body?.values || [["Date", "Start", "Duration", "Host", "Topic", "Status", "Requested by", "Email", "Notes"]];
    const mapped = slotsFromUsedRange(day, values);
    const current = mapped.slots.find((s) => s.id === slotId);
    if (!current || current.status !== "open") {
      sendJson(res, 409, {
        ok: false,
        reason: "That slot is not open in the SharePoint workbook corpus.",
        coverage: {
          scope: "sharepoint-excel",
          completeness: "partial",
          corpusSize: mapped.slots.length,
          sources: [{ label: `SharePoint Excel ${worksheetId(env)}`, count: mapped.slots.length }],
          limitations: [mapped.coverageNote],
          searchedAt: new Date().toISOString(),
        },
      });
      return;
    }

    const booking = {
      day,
      startsAt: startsAtIso(day, clock.hour, clock.minute),
      durationMinutes: window.durationMinutes,
      hostName: "Brand Integrated Marketing",
      title: title || "Deep Dive",
      requesterName,
      requesterEmail,
      audience,
      notes,
    };
    const append = buildAppendValues(values, booking);
    const excelRow = nextAppendRow(values);
    const endCol = colLetter(append.colCount - 1);
    const address = `A${excelRow}:${endCol}${excelRow}`;
    const patch = await updateRange(env, auth.token, address, [append.row], sessionId);
    if (!patch.ok) {
      sendJson(res, 502, {
        ok: false,
        reason:
          patch.body?.error?.message ||
          patch.body?.error ||
          `updateRange failed (${patch.status})`,
      });
      return;
    }

    const slot = {
      id: slotIdFor(day, clock.hour, clock.minute),
      startsAt: booking.startsAt,
      durationMinutes: booking.durationMinutes,
      hostName: booking.hostName,
      title: booking.title,
      status: "booked",
      requesterName,
      requesterEmail,
      notes: notes || undefined,
      audience: audience || undefined,
      bookedAt: new Date().toISOString(),
    };

    sendJson(res, 200, {
      ok: true,
      slot,
      coverage: {
        scope: "sharepoint-excel",
        completeness: "partial",
        corpusSize: mapped.slots.length,
        sources: [
          {
            label: `SharePoint Excel worksheet ${worksheetId(env)} (wrote row ${excelRow})`,
            count: mapped.slots.length,
          },
        ],
        limitations: [
          "Booking was written to the Brand Integrated Marketing workbook only — not an organization-wide calendar feed.",
        ],
        searchedAt: new Date().toISOString(),
      },
    });
  } finally {
    await closeSession(env, auth.token, sessionId).catch(() => {});
  }
}

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  try {
    if (req.method === "GET" && (path === "/health" || path === "/")) {
      await handleHealth(req, res);
      return;
    }
    if (req.method === "GET" && path === "/slots") {
      await handleSlots(req, res, url);
      return;
    }
    if (req.method === "POST" && path === "/book") {
      await handleBook(req, res);
      return;
    }
    sendJson(res, 404, { error: "Not found. Use GET /health, GET /slots?day=, POST /book." });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

if (once) {
  const result = await buildHealth();
  console.log(JSON.stringify(result.body, null, 2));
  process.exit(result.body.connected ? 0 : 1);
}

createServer(handle).listen(PORT, "127.0.0.1", () => {
  console.log(`Deep Dive proxy listening on http://127.0.0.1:${PORT}`);
  console.log(
    `Auth: token=${(env.GRAPH_ACCESS_TOKEN || "").trim() ? "set" : "missing"}, liveWrite=${liveWriteEnabled(env)}`,
  );
});
