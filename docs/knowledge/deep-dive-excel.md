# Deep Dive Excel (SharePoint system of record)

**Status:** discovery in progress — Composio Excel/SharePoint connections must be **Active** before
`site_id` / `item_id` can be resolved. Mission Control uses `LocalMeetingScheduler` until Vendor
Management approves a live path (decision 044).

## Workbook link (sharing URL)

```
https://aaalife.sharepoint.com/:x:/s/BrandIntegratedMarketing/IQDf5u2BAWNdSqq6UneM3YzIAUBLR7H9oMA1rOPSTrekCRc?e=O0IM9e
```

| Parsed from URL | Value |
| --- | --- |
| Host | `aaalife.sharepoint.com` |
| Site path | `/sites/BrandIntegratedMarketing` (from `/s/BrandIntegratedMarketing/`) |
| Share token | `IQDf5u2BAWNdSqq6UneM3YzIAUBLR7H9oMA1rOPSTrekCRc` (not a Graph `item_id`) |

## Graph identifiers (blocked until OAuth Active)

| Field | Value | Notes |
| --- | --- | --- |
| `site_id` | *pending Active excel + share_point* | Graph form `hostname,siteCollectionId,siteId` |
| `drive_id` | *pending* | Default library unless file lives elsewhere |
| `item_id` | *pending* | Excel drive item id — **not** the sharing token above |
| Workbook display name | *pending* | Confirm from Graph metadata |

**Resolution plan (Composio session `ride`, after Active):**

1. `SHARE_POINT_SEARCH_QUERY` or `SHARE_POINT_GET_SITE_DRIVE_ITEM_BY_PATH` on BrandIntegratedMarketing
2. Capture `site_id`, `drive_id`, `item_id`
3. `EXCEL_LIST_SHAREPOINT_WORKSHEETS` → scheduling sheet
4. `EXCEL_GET_WORKSHEET_USED_RANGE` / `EXCEL_GET_SHAREPOINT_RANGE` → replace provisional schema

## Composio (Cursor discovery only)

- MCP URL in `.cursor/mcp.json`: `https://connect.composio.dev/mcp`
- Toolkits: **excel** (ranges/tables), **share_point** (search/path)
- Does **not** run in the Vite app. Runtime live Excel must use a server proxy (Workfront pattern).
- Never put Microsoft or Composio secrets in `VITE_*` variables.

### OAuth status (agent-initiated)

Connections were initiated for discovery. Finish sign-in with **@aaalife.com** (tenant admin consent
if Azure AD blocks). Links expire quickly; re-run `COMPOSIO_MANAGE_CONNECTIONS` if needed.

| Toolkit | Account alias | Status at last check |
| --- | --- | --- |
| excel | `aaalife-deep-dive` | initiated / initializing — not Active |
| share_point | `aaalife-brand` | initiated / initializing — not Active |

## Provisional schema (fixtures until live capture)

Used by `LocalMeetingScheduler` (`src/lib/meetings/`) so `/deep-dive` can ship before the sheet is
mapped. Replace this table when live worksheets/ranges are read.

| Field (UI) | Fixture key | Likely Excel column (to confirm) | Notes |
| --- | --- | --- | --- |
| Date | (UI `day`) | Date | Custom picker; Oct–Dec 2026 quarter; **Wednesdays only** |
| Slot start | `startsAt` | Date / Start | ISO in stub; sheet may split date+time |
| Duration (minutes) | `durationMinutes` | Duration | 10 for 1:05–1:15; **15** for later bands |
| Host / facilitator | `hostName` | Host | Display only in stub |
| Topic / title | `title` | Topic | Optional on book |
| Status | `status` | Status | `open` \| `booked` |
| Requester name | `requesterName` | Requested by / Entered By | PII — local stub only |
| Requester email | `requesterEmail` | Email | PII — local stub only |
| Notes | `notes` | Notes | Optional |

**Default open windows (local stub):** meetings on **Wednesdays** only in the initial quarter
(**October–December 2026**). For a selected Wednesday: **1:05 – 1:15**, **1:15 – 1:30**,
**1:30 – 1:45**, **1:45 – 2:00** (nothing after 2:00 PM). Past dates are muted in the picker and
in **View this month's calendar**. Open time slot remains a dropdown (`Choose a time slot`).

**Booking write rule (stub):** append a `booked` row to `localStorage` key `aaa-deep-dive-slots`
(backup `aaa-deep-dive-slots-backup`). Open slots are generated, not stored. Success modal links to
the SharePoint workbook and states that the user is leaving Mission Control. Live Excel write and
**Entered By** are TBD after schema capture.

**Coverage disclosure (guardrail 7):** the Deep Dive UI states that availability comes from this
browser’s local stub corpus, not organization-wide SharePoint, until the live adapter is on.

## Vendor Management

See decision **044**. No Mission Control → Graph/Excel/Composio call until approved.
