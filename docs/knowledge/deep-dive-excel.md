# Deep Dive Excel (SharePoint system of record)

**Status:** Phase A discovery depends on Composio Excel + SharePoint **Active** OAuth. Phase B
proxy + `SharePointExcelScheduler` ship with **`DEEP_DIVE_LIVE_WRITE=0`** until Vendor Management
clears PII writes (decisions 044, 046).

## Workbook link (sharing URL)

```
https://aaalife.sharepoint.com/:x:/s/BrandIntegratedMarketing/IQDf5u2BAWNdSqq6UneM3YzIAUBLR7H9oMA1rOPSTrekCRc?e=O0IM9e
```

| Parsed from URL | Value |
| --- | --- |
| Host | `aaalife.sharepoint.com` |
| Site path | `/sites/BrandIntegratedMarketing` (from `/s/BrandIntegratedMarketing/`) |
| Share token | `IQDf5u2BAWNdSqq6UneM3YzIAUBLR7H9oMA1rOPSTrekCRc` (not a Graph `item_id`) |

## Graph identifiers

| Field | Value | Notes |
| --- | --- | --- |
| `site_id` | *pending Active Composio excel + share_point* | Graph form `hostname,siteCollectionId,siteId` — paste into `.env.deep-dive.local` as `GRAPH_SITE_ID` |
| `drive_id` | *pending* | `GRAPH_DRIVE_ID` if not default library |
| `item_id` | *pending* | Excel drive item id — **not** the sharing token above (`GRAPH_ITEM_ID`) |
| Workbook display name | *pending* | Confirm from Graph metadata |
| Worksheet | provisional `Sheet1` | Override with `GRAPH_WORKSHEET_ID` after `EXCEL_LIST_SHAREPOINT_WORKSHEETS` |

**Resolution plan (Composio session after Active):**

1. `SHARE_POINT_SEARCH_QUERY` or `SHARE_POINT_GET_SITE_DRIVE_ITEM_BY_PATH` on BrandIntegratedMarketing
2. Capture `site_id`, `drive_id`, `item_id`
3. `EXCEL_LIST_SHAREPOINT_WORKSHEETS` → scheduling sheet
4. `EXCEL_GET_WORKSHEET_USED_RANGE` / `EXCEL_GET_SHAREPOINT_RANGE` → replace provisional schema
5. Optional non-PII write probe via `EXCEL_UPDATE_RANGE`, then revert

## Runtime (Mission Control) — Phase B

| Layer | Path |
| --- | --- |
| UI | `/deep-dive` → `SharePointExcelScheduler` |
| Client | Same-origin `GET/POST /api/deep-dive/*` (no Graph secrets) |
| Vite | Proxies to `http://127.0.0.1:8788` (`DEEP_DIVE_PROXY_TARGET`) |
| Proxy | [`deep-dive-proxy/`](../../deep-dive-proxy/README.md) — Graph token / app credentials in `.env.deep-dive.local` |
| Kill switch | `DEEP_DIVE_LIVE_WRITE=1` + `confirmLive: true` required for `POST /book` |

Composio does **not** run in the Vite app. Never put Microsoft or Composio secrets in `VITE_*`.

## Composio (Cursor discovery only)

- MCP URL in `.cursor/mcp.json`: `https://connect.composio.dev/mcp`
- Toolkits: **excel**, **share_point**
- **Preferred Microsoft sign-in (email only):** `p92654@aaalife.com` — use this identity on both Excel and SharePoint OAuth consent screens (tenant admin consent if Azure AD blocks). Do not store passwords, PATs, or refresh tokens in the repo.
- Finish sign-in as **p92654@aaalife.com** (not a personal Microsoft account).

| Toolkit | Preferred account alias | Notes |
| --- | --- | --- |
| excel | `p92654-excel` | Fresh OAuth; prior aliases may exist as `*-prior` / `aaalife-deep-dive` |
| share_point | `p92654-sharepoint` | Fresh OAuth; prior aliases may exist as `*-prior` / `aaalife-brand` |

Status of Composio accounts is live in the Cursor MCP session (Active / initializing). Graph `site_id` / `item_id` stay pending until both preferred aliases are **Active**.

## Provisional schema (until live capture)

Used by local stub + proxy column alias map (`deep-dive-proxy/lib/slots.mjs`).

| Field (UI) | Fixture key | Likely Excel column (to confirm) | Notes |
| --- | --- | --- | --- |
| Date | (UI `day`) | Date | Wednesdays only Oct–Dec 2026 |
| Slot start | `startsAt` | Start / Time | ISO in stub |
| Duration (minutes) | `durationMinutes` | Duration | 10 for 1:05–1:15; 15 thereafter |
| Host / facilitator | `hostName` | Host | |
| Topic / title | `title` | Topic | |
| Status | `status` | Status | `open` \| `booked` |
| Requester name | `requesterName` | Requested by / Entered By | PII — network write gated |
| Requester email | `requesterEmail` | Email | PII — network write gated |
| Notes | `notes` | Notes | May include Audience |

**Default open windows:** Wednesdays, **1:05 – 2:00 PM** bands (see `SLOT_WINDOWS`).

**Booking (local):** `aaa-deep-dive-slots` / backup key. **Booking (live):** proxy appends a row when kill switch is on.

**Coverage (guardrail 7):** UI/proxy always name local stub vs SharePoint workbook corpus; never claim organization-wide search.

## Vendor Management

See decisions **044** and **046**. No production PII write to Excel until approved; kill switch stays `0` by default.
