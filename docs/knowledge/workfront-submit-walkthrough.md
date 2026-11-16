# How to submit a request (today) and what dual-write adds

**Status:** walkthrough for Ready-to-send (local), dual-write **New Project** create in
TEST PORTFOLIO - CHRIS, brief deciphering, and document upload to project Documents → **Intake**
(`WORKFRONT_LIVE_SUBMIT=1`, decisions 035–036, **057**).

Task dual-write onto **mission-control-v1** is superseded by **055**; Brand template landing is
superseded by **057**.

## Prerequisites

1. `npm run dev` → http://localhost:5173/
2. `npm run workfront:proxy` → http://127.0.0.1:8787/health
3. Request queue badge: **Workfront: connected**
4. **S2S tech account can create projects under TEST PORTFOLIO - CHRIS** — otherwise create fails
   with *insufficient access*. Admin steps: [`workfront-test-portfolio-acl.md`](workfront-test-portfolio-acl.md).  
   Quick check: `npm run workfront:sample-project` (expects `"ok": true`).

Without the proxy, health shows not connected. Credentials live only in gitignored
`.env.workfront.local` (never `VITE_*`).

---

## How the Adobe Workfront hierarchy maps to Mission Control

| Layer | Workfront object | Mission Control role |
| --- | --- | --- |
| **Portfolio (create + Refresh)** | `TEST PORTFOLIO - CHRIS` (`WORKFRONT_PORTFOLIO_ID`) | Landing place for live Send / Accept creates; Refresh corpus; Apply order |
| **Project** | Bare New Project per intake | Created via `POST /projects` (`name` + `description` + `portfolioID`) |
| **Documents** | New project Documents → **Intake** folder | Session files after create |

### Documents placement (after New Project create)

When session `File` binaries are available:

1. Each original file is placed in the new project's **Documents → Intake** folder
   (`docObjCode: "PROJ"`, `objID: <newProjectID>`). The proxy creates the folder if needed.

Proxy routes:

| Path (local / Vercel) | Role |
| --- | --- |
| `POST /projects` / `POST /api/workfront/projects` | Create New Project in TEST PORTFOLIO; kill switch + `confirmLive: true` |
| `GET /projects` / `GET /api/workfront/projects` | List TEST PORTFOLIO projects (summary fields) for Refresh |
| `POST /documents` / `POST /api/workfront/documents` | Upload binary to project Intake folder; kill switch + `confirmLive: true`; raw file capped at 3 MB |

Binary files never go into `localStorage`. They stay in an in-memory session map
(`attachmentFileStore`) keyed by brief id until upload or tab close. A reloaded Summary page
shows **Attach file to upload** when binaries are missing.

---

## Path A — New request → Ready to send (always local)

1. Home → **Start a new request** → `/request`
2. Complete identity → context → guided questions → related work → review
3. Mark **Ready to send** — saves in this browser and builds the real A3 payload
4. Open **Request queue** (`/deliverables`) — row shows **Sent to Workfront: No**
5. Optional: **Summary** → **Workfront payload** to inspect name, description, customForm

Ready to send does **not** create a Workfront project by itself.

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
4. Open **Request Queue** (`/deliverables`) → open **Summary** (or kebab → Summary),
   verify attachments show **Ready to upload** (green readiness) or use **Attach file to upload**
   if opening from a later browser session.
5. Click **Accept — Send to Workfront** (or queue kebab **Send to WF**):
   - **Without** `WORKFRONT_LIVE_SUBMIT=1`: still local; honest “not sent” messaging.
   - **With** kill switch on: confirm dialog (New Project in TEST PORTFOLIO + Entered By +
     attachment readiness) → proxy `POST /projects` creates a bare **Project** in TEST PORTFOLIO -
     CHRIS → name from intake summary → Overview **Description** carries the intake information →
     for each session file, proxy `POST /documents` attaches to Documents → **Intake** →
     UI may show **Sent to Workfront: (WF Aligned)** only when a real Project ID is stored
     (storage key remains `workfront.issueId`). The sent dialog lists uploaded document names; a
     non-fatal document error still keeps the Project ID if create succeeded.

---

## Where projects land

| Field | Value |
| --- | --- |
| Portfolio | TEST PORTFOLIO - CHRIS (`WORKFRONT_PORTFOLIO_ID`) |
| Status | `CUR` (Current) so it appears under portfolio **Projects** (decision 060) |
| Optimization | Not ranked on create; only Executive Apply order writes `portfolioPriority` |
| Template | BIM \| EMAIL CREATIVE DEVELOPMENT TEMPLATE (`669e92cd…`; decision 059) |
| Workstart Task | Created on project `6afa92ea…` named **Workstart**, assigned to **Chris Calabrese** |
| Object | Project (PROJ) from template in the portfolio, plus Workstart Task on the Communications effort project |
| Entered By | Signed-in Adobe user when a bearer is present; otherwise S2S tech account |
| Requester | Description audit lines in Overview Description |
| Documents | Project Documents → **Intake** folder (when session files uploaded) |

If binaries were unavailable (reload), attachment **names** still ride in the project description /
payload; re-attach on Summary before live send to upload the originals.

Request Queue **Priority (P1–P3)** is local-only for now (decision **053**). It is not written on
project create and is not overwritten by Refresh.

---

## Priority: urgency vs Portfolio Optimization order

These are **two different Workfront fields**. Do not use one control for both.

### Request Queue Priority (P1–P3) — local only

Change the Priority select or Summary Override priority — values stay in this browser under
`brief.reviewer.priority`. No Workfront urgency write until dual-write is re-enabled.

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

1. Share TEST PORTFOLIO - CHRIS `6aa167f4000304470fb9e879fb8bbd56` with **Manage** for the S2S
   tech account — see [`workfront-test-portfolio-acl.md`](workfront-test-portfolio-acl.md).
2. Set `WORKFRONT_PORTFOLIO_ID=6aa167f4000304470fb9e879fb8bbd56` and `WORKFRONT_LIVE_SUBMIT=1`
   only when dual-write is approved (never `VITE_*`).
3. After first live send, open the new project in TEST PORTFOLIO → **Overview → Description** and
   **Documents → Intake**.
4. After Apply order, confirm `#` ranks in Portfolio Optimization match Mission Control.

---

## Queue sync (pull)

With the proxy up, Request queue can **Refresh from Workfront** to list projects in TEST PORTFOLIO -
CHRIS (summary fields) and **upsert them into this browser’s Request Queue** (Workfront wins on
match by Project ID / name). Coverage copy names that portfolio — never organization-wide. Local-only
rows without a matching project are kept.
