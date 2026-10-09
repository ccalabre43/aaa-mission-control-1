# How to submit a request (today) and what dual-write adds

**Status:** walkthrough for Ready-to-send (local) and dual-write **Task** create
(`WORKFRONT_LIVE_SUBMIT=1`, decisions 035–036).

## Prerequisites

1. `npm run dev` → http://localhost:5173/
2. `npm run workfront:proxy` → http://127.0.0.1:8787/health
3. Request queue badge: **Workfront: connected (mission-control-v1)**
4. **S2S tech account can Add Tasks** — otherwise create fails with *insufficient access*.
   Admin steps: [`workfront-add-tasks-acl.md`](workfront-add-tasks-acl.md).  
   Quick check: `npm run workfront:sample-create` (expects `"ok": true`).

Without the proxy, health shows not connected. Credentials live only in gitignored
`.env.workfront.local` (never `VITE_*`).

## Path A — New request → Ready to send (always local)

1. Home → **Intake Form** / **Start Request** → `/request`
2. Complete identity → context → guided questions → related work → review
3. Mark **Ready to send** — saves in this browser and builds the real A3 payload
4. Open **Request queue** (`/deliverables`) — row shows **Sent to Workfront: No**
5. Optional: **Summary** → **Workfront payload** to inspect name, description, customForm,
   `queueTopicID`, `projectID`

Ready to send does **not** create a Workfront Task by itself.

## Path B — Explicit send to Workfront Que

1. `/deliverables` → open a Ready-to-send row → **Summary**
2. Use **Submit to Workfront Que**
3. **Without** `WORKFRONT_LIVE_SUBMIT=1`: still local; honest “not sent” messaging
4. **With** kill switch on: confirm dialog (integration account Entered By) → proxy
   `POST /issues` (creates a **Task**) on **mission-control-v1** → UI may show
   **Sent to Workfront: Yes (Task …)** only when a real Task ID is stored

## Where Tasks land

| Field | Value |
| --- | --- |
| Project | mission-control-v1 (`6abae2b600041e3ecb6a8da4dbe7b4a1`) |
| Object | Task (project Tasks tab), not Issue |
| Entered By | S2S tech account |
| Requester | `A3IntakeRequestedBy` + description audit lines |
| Columns | Best-guess: name, description, plannedCompletionDate, A3 custom form when accepted |

Attachments: file **names** only until a document upload path exists.

## Queue sync (pull)

With the proxy up, Request queue can **Refresh from Workfront** to list Tasks on
mission-control-v1 (summary fields) and **upsert them into this browser’s Request Queue**
(`aaa-intake-briefs`). Match by Task ID, then exact Task name; Workfront wins on conflict for
surface fields (name, entry date, mapped status/priority, assigned display name, `workfront`
link). Local-only briefs without a matching Task are kept. Coverage must name that project plus
local briefs — never imply organization-wide coverage.
