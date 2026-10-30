# Deep Dive proxy (SharePoint Excel)

Local Node stand-in that holds Microsoft Graph credentials and exposes health, slot list, and
book for Mission Control. The Vite app never sees `GRAPH_*` secrets (decision 044 / 046).

**Composio** is for Cursor discovery only (site/item ids, sheet schema). Runtime uses Graph via
this proxy — same pattern as `workfront-proxy/`.

## Setup

```bash
cp deep-dive-proxy/.env.example .env.deep-dive.local
# Fill GRAPH_SITE_ID, GRAPH_ITEM_ID (from docs/knowledge/deep-dive-excel.md after Composio Active)
# Optional: GRAPH_ACCESS_TOKEN for delegated verify, or app client credentials
# Keep DEEP_DIVE_LIVE_WRITE=0 until Vendor Management + privacy clear PII writes
```

```bash
npm run deep-dive:proxy
curl -sS http://127.0.0.1:8788/health
curl -sS 'http://127.0.0.1:8788/slots?day=2026-10-29'
```

Vite forwards `/api/deep-dive` → `http://127.0.0.1:8788` during `npm run dev`.

## Kill switch

`DEEP_DIVE_LIVE_WRITE=1` is required for `POST /book`, plus JSON `confirmLive: true`.
Without both, the proxy refuses network writes of requester name/email.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | `connected`, `liveWrite`, workbook config |
| GET | `/slots?day=YYYY-MM-DD` | Open slots from sheet merge (or local grid fallback) |
| POST | `/book` | Append booked row when kill switch on |
