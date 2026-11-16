# How to submit a request (today) and what dual-write adds

**Status:** walkthrough for Ready-to-send (local), dual-write **Brand Team Project** create from
the Email Creative Development template, brief deciphering, and document upload to project
Documents → **Intake** (`WORKFRONT_LIVE_SUBMIT=1`, decisions 035–036, **055**).

Task dual-write onto **mission-control-v1** is superseded by decision **055**.

## Prerequisites

1. `npm run dev` → http://localhost:5173/
2. `npm run workfront:proxy` → http://127.0.0.1:8787/health
3. Request queue badge: **Workfront: connected**
4. **S2S tech account can create projects from the Email Creative Development Template and under
   the Brand Team portfolio** — otherwise create fails with *insufficient access*.
   Admin steps: [`workfront-brand-project-acl.md`](workfront-brand-project-acl.md).  
   Quick check: `npm run workfront:sample-project` (expects `"ok": true`).

Without the proxy, health shows not connected. Credentials live only in gitignored
`.env.workfront.local` (never `VITE_*`).

---

## How the Adobe Workfront hierarchy maps to Mission Control

| Layer | Workfront object | Mission Control role |
| --- | --- | --- |
| **Portfolio (Brand)** | Brand Team portfolio (`WORKFRONT_BRAND_PORTFOLIO_ID`) | Landing place for live Send / Accept creates; Refresh corpus |
| **Portfolio (Executive)** | `TEST PORTFOLIO - CHRIS` (`WORKFRONT_PORTFOLIO_ID`) | Portfolio Optimization `#` / Apply order only |
| **Template (TMPL)** | BIM Email Creative Development (`WORKFRONT_TEMPLATE_ID`) | Source of phases (Intake → Compliance) on create |
| **Project** | New Brand project per intake | Created via `POST /projects` (`templateID` + `portfolioID` + name + description) |
| **Documents** | New project Documents → **Intake** folder | Session files after create |

### Documents placement (after Brand project create)

When session `File` binaries are available:

1. Each original file is placed in the new project's **Documents → Intake** folder
   (`docObjCode: "PROJ"`, `objID: <newProjectID>`). The proxy creates the folder if needed.

Proxy routes:

| Path (local / Vercel) | Role |
| --- | --- |
| `POST /projects` / `POST /api/workfront/projects` | Create Brand project from template; kill switch + `confirmLive: true` |
| `GET /projects` / `GET /api/workfront/projects` | List Brand portfolio projects (summary fields) for Refresh |
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
   - **With** kill switch on: confirm dialog (Brand project + Entered By + attachment readiness) →
     proxy `POST /projects` creates a **Project** from the Email Creative Development template in
     the Brand Team portfolio → Overview **Description** carries the intake summary → for each
     session file, proxy `POST /documents` attaches to Documents → **Intake** →
     UI may show **Sent to Workfront: (WF Aligned)** only when a real Project ID is stored
     (storage key remains `workfront.issueId`). The sent dialog lists uploaded document names; a
     non-fatal document error still keeps the Project ID if create succeeded.

---

## Where projects land

| Field | Value |
| --- | --- |
| Portfolio | Brand Team (`WORKFRONT_BRAND_PORTFOLIO_ID`) |
| Template | Email Creative Development TMPL (`WORKFRONT_TEMPLATE_ID`) |
| Object | Project (PROJ), not Task on mission-control-v1 |
| Entered By | Signed-in Adobe user when a bearer is present; otherwise S2S tech account |
| Requester | `A3IntakeRequestedBy` + description audit lines in Overview Description |
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

1. Confirm TMPL id `669e92cd00136878c607c40cf02e356c` (not the pattern Project URL id) and share it
   with the S2S tech account — see [`workfront-brand-project-acl.md`](workfront-brand-project-acl.md).
2. Share Brand Team portfolio `63fe29510080e44cc362ace791da828a` with Manage for the tech account.
3. Set `WORKFRONT_TEMPLATE_ID`, `WORKFRONT_BRAND_PORTFOLIO_ID`, keep `WORKFRONT_PORTFOLIO_ID` for
   TEST PORTFOLIO - CHRIS, and `WORKFRONT_LIVE_SUBMIT=1` only when dual-write is approved
   (never `VITE_*`).
4. After first live send, open the new project → **Overview → Description** and **Documents →
   Intake**; confirm Brand Team Projects report filters include the new status.
5. After Apply order, confirm `#` ranks in Portfolio Optimization match Mission Control.

---

## Queue sync (pull)

With the proxy up, Request queue can **Refresh from Workfront** to list projects in the Brand Team
portfolio (summary fields) and **upsert them into this browser’s Request Queue** (Workfront wins on
match by Project ID / name). Coverage copy names that portfolio — never organization-wide. Local-only
rows without a matching project are kept.
