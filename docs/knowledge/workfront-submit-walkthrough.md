# How to submit a request (today) and what dual-write adds

**Status:** walkthrough for Ready-to-send (local), dual-write **Task** create, brief
deciphering, and document upload to Task Documents + project **Tasks** folder
(`WORKFRONT_LIVE_SUBMIT=1`, decisions 035–036).

## Prerequisites

1. `npm run dev` → http://localhost:5173/
2. `npm run workfront:proxy` → http://127.0.0.1:8787/health
3. Request queue badge: **Workfront: connected (mission-control-v1)**
4. **S2S tech account can Add Tasks and Add Documents / Folders** — otherwise create or
   upload fails with *insufficient access*.
   Admin steps: [`workfront-add-tasks-acl.md`](workfront-add-tasks-acl.md).  
   Quick check: `npm run workfront:sample-create` (expects `"ok": true`).

Without the proxy, health shows not connected. Credentials live only in gitignored
`.env.workfront.local` (never `VITE_*`).

---

## How the Adobe Workfront hierarchy maps to Mission Control

| Layer | Workfront object | Mission Control role |
| --- | --- | --- |
| **Portfolio** | `TEST PORTFOLIO - CHRIS` | Parent governance container (Portfolio ID on Project details) |
| **Project** | `mission-control-v1` (`6abae2b600041e3ecb6a8da4dbe7b4a1`) | Configured via `WORKFRONT_PROJECT_ID` |
| **Project Tasks tab** | `mission-control-v1/Tasks` | Every live **Submit to Workfront Que** creates a `TASK` (`POST /attask/api/v19.0/TASK`) with `projectID = 6abae2b600041e3ecb6a8da4dbe7b4a1`, ALAN-prefixed name, A3 description + audit trail, and A3 custom form parameters |
| **Documents** | Project Documents + Task Documents | See below |

### Documents placement (after Task create)

When session `File` binaries are available:

1. Each original file is attached to the **Task Documents** tab (`docObjCode: "TASK"`, `objID: <newTaskID>`).
2. Each file is also placed in the **`Tasks` folder** inside `mission-control-v1` → **Documents**
   (`docObjCode: "PROJ"`, `objID: 6abae2b600041e3ecb6a8da4dbe7b4a1`, `folderID: <Tasks DOCFDR ID>`).
   The proxy creates the `Tasks` document folder if it does not exist yet.

Proxy routes:

| Path (local / Vercel) | Role |
| --- | --- |
| `POST /documents` / `POST /api/workfront/documents` | Upload binary once per placement (Task + project Tasks folder); requires kill switch + `confirmLive: true`; raw file capped at 3 MB |

Binary files never go into `localStorage`. They stay in an in-memory session map
(`attachmentFileStore`) keyed by brief id until upload or tab close. A reloaded Summary page
shows **Attach file to upload** when binaries are missing.

---

## Path A — New request → Ready to send (always local)

1. Home → **Start a new request** → `/request`
2. Complete identity → context → guided questions → related work → review
3. Mark **Ready to send** — saves in this browser and builds the real A3 payload
4. Open **Request queue** (`/deliverables`) — row shows **Sent to Workfront: No**
5. Optional: **Summary** → **Workfront payload** to inspect name, description, customForm,
   `queueTopicID`, `projectID`

Ready to send does **not** create a Workfront Task by itself.

### Brief deciphering on the Context step

Drop a creative or strategy brief (`.docx`, text-layer `.pdf`, `.txt`, `.md`, or basic `.rtf`)
onto the Context dropzone:

1. Parsing runs **entirely in the browser** (ZIP/XML for `.docx`, PDF content streams for
   selectable text, no third-party PDF/LLM vendor).
2. Empty guided answers are pre-filled from recognized headings (Background, Project Summary,
   Deliverables, Goals, Success Measurement, timing, supplemental audience/messaging, and so on).
   Already-typed answers are never overwritten.
3. Each pre-filled question shows an audit note: file name + matched section heading
   (Guardrail 7 — auditable recommendations).
4. ALAN numbers are detected from filenames and extracted text (`ALAN-\d{5}-\d{3}-\d{2}`).
5. Scanned image PDFs with no text layer return an honest note that no selectable text was found.

---

## Path B — Dashboard to Workfront (step-by-step)

1. **Start a new request** (`/request`) and enter requester identity.
2. Drop the creative/strategy brief onto the Context dropzone → verify deciphered ALAN (if any)
   and the pre-filled question count status under the attachment list.
3. Step through Questions 1–9 → review each pre-filled answer and its source citation →
   complete related work → click **Mark Ready to Send** on Review draft.
4. Open **Request Queue** (`/deliverables`) → click **Review** on the request → on Summary,
   verify attachments show **Ready to upload** (green readiness) or use **Attach file to upload**
   if opening from a later browser session.
5. Click **Submit to Workfront Que**:
   - **Without** `WORKFRONT_LIVE_SUBMIT=1`: still local; honest “not sent” messaging.
   - **With** kill switch on: confirm dialog (Entered By disclosure + attachment readiness) →
     proxy `POST /issues` creates a **Task** on **mission-control-v1** → for each session file,
     proxy `POST /documents` attaches to Task Documents and the project **Tasks** folder →
     UI may show **Sent to Workfront: (WF Aligned)** only when a real Task ID is stored
     (hover for Task ID). The sent dialog lists uploaded document names; a non-fatal document
     error still keeps the Task ID if create succeeded.

---

## Where Tasks land

| Field | Value |
| --- | --- |
| Project | mission-control-v1 (`6abae2b600041e3ecb6a8da4dbe7b4a1`) |
| Object | Task (project Tasks tab), not Issue |
| Entered By | Signed-in Adobe user when a bearer is present; otherwise S2S tech account |
| Requester | `A3IntakeRequestedBy` + description audit lines |
| Columns | Best-guess: name, description, plannedCompletionDate, A3 custom form when accepted |
| Documents | Task Documents tab + project Documents → **Tasks** folder (when session files uploaded) |

If binaries were unavailable (reload), attachment **names** still ride in the Task description /
payload; re-attach on Summary before live send to upload the originals.

Request Queue **Priority (P1–P3)** is local-only for now (decision **053**). It is not written on
Task create and is not overwritten by Refresh. Task urgency dual-write can return later.

---

## Priority: urgency vs Portfolio Optimization order

These are **two different Workfront fields**. Do not use one control for both.

### Request Queue Priority (P1–P3) — local only

Change the Priority select or Summary Override priority — values stay in this browser under
`brief.reviewer.priority`. No Workfront Task `priority` write until dual-write is re-enabled.

### Executive Apply order → Portfolio Optimization `#`

1. Open **Request Queue** → **Executive** tab.
2. **Portfolio Optimization order** lists projects in `WORKFRONT_PORTFOLIO_ID` (TEST PORTFOLIO -
   CHRIS) sorted by `portfolioPriority`.
3. Reorder with the grip (drag, arrow keys, or Move up / Move down).
4. Click **Apply order** (Workfront Set Priority analogue) → confirm → proxy `POST /portfolio`
   writes contiguous `portfolioPriority` values.
5. Verify in Workfront: Portfolio → **TEST PORTFOLIO - CHRIS** → **Portfolio Optimization** → `#`.

---

## Workfront admin checklist

1. Confirm Project `mission-control-v1` is assigned to Portfolio **TEST PORTFOLIO - CHRIS**
   in Project Details → Finance / Portfolio.
2. Confirm the S2S tech account / signed-in user Access Level allows **Add Tasks** and
   **Add Documents / Folders** on `mission-control-v1`, and **Manage** on portfolio projects for
   Apply order.
3. Confirm `WORKFRONT_PROJECT_ID=6abae2b600041e3ecb6a8da4dbe7b4a1`, set
   `WORKFRONT_PORTFOLIO_ID` to the Portfolio ID for TEST PORTFOLIO - CHRIS, and
   `WORKFRONT_LIVE_SUBMIT=1` only when dual-write is approved (never `VITE_*`).
4. After first live send with attachments, open the new Task’s **Documents** tab and
   `mission-control-v1` → **Documents** → **Tasks** folder and confirm both copies.
5. After Apply order, confirm `#` ranks in Portfolio Optimization match Mission Control.

---

## Queue sync (pull)

With the proxy up, Request queue can **Refresh from Workfront** to list Tasks on
mission-control-v1 (summary fields) and **upsert them into this browser’s Request Queue**
(`aaa-intake-briefs`). Match by Task ID, then exact Task name; Workfront wins on conflict for
surface fields (name, entry date, mapped status/priority, assigned display name, `workfront`
link). Local-only briefs without a matching Task are kept. Coverage must name that project plus
local briefs — never imply organization-wide coverage.
