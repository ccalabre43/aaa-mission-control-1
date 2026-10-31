# Reviewer queue fields and Workfront mapping

- **Status:** active; Priority urgency dual-write and Portfolio Optimization order ship gated by
  `WORKFRONT_LIVE_SUBMIT` (decision **052**)
- **UI source:** `assets/mocks/request-queue-reviewer-interface.png`,
  `assets/mocks/request-summary-page.png`
- **Related:** `docs/workfront-auth.md`, `docs/knowledge/a3-schema.md`, decisions 030, 052

The Mission Control Request Queue is reviewer-styled but still a **request list** aimed at the
Workfront queue project `mission-control-v1`. Reviewer Status stays local. Reviewer Priority (P1–P3)
is **Task urgency** and can dual-write native Task `priority` when live submit is on and the row has
a Task ID. Portfolio Optimization drag order is a **separate** control on the Executive tab
(project `portfolioPriority`), not the Request Queue Priority select.

## Column sources today

| UI column | App source now | Workfront |
| --- | --- | --- |
| Subject | Issue name from `buildWorkfrontPayload` / `briefTitle` | Task `name` |
| Channels | Removed from the Request Queue table; still used in search via `A3IntakeDeliverables` tokens | Same custom field (paragraph on the A3 form) |
| Status | `brief.reviewer.status` (local) | Native Task/Issue `status` with a request-queue status group, **or** custom dropdown if native cannot match — write not enabled yet |
| Priority | `brief.reviewer.priority` (local + dual-write) | Native Task `priority` (see map below) |
| Entry Date | `submittedAt` or `createdAt` | Task `entryDate` |
| Requestor | Identity name + initials (no email in the table) | `A3IntakeRequestedBy`; Entered By under S2S is the tech account |
| NEW badge | Submitted/ready and `reviewer.firstReviewedAt` is null | Derived from entry date + status; no new field |
| Size | `brief.reviewer.size` (local S/M/L; default M) | No A3 field; Summary triage only (Concept v1). Not posted to Workfront |
| Impact / Effort / Risk | `brief.reviewer.impact` / `effort` / `risk` (local High/Medium/Low) | No A3 field yet; possible custom dropdowns later as a Workfront config request only |

Summary’s two-column brief card (Concept v1 labels) is local display: `buildSummaryBriefFields`
reads `brief.a3` then falls back to `answers` / `contextText` (decision 042). It does not change
the Workfront payload beyond Priority on live create.

## Two priority controls (do not merge)

Adobe documents that Portfolio Optimization drag/`#` is **unrelated** to the Priority field on
Project/Task details. Mission Control mirrors that split:

| Control | Where | Meaning | Workfront field |
| --- | --- | --- | --- |
| Priority select P1–P3 | Request Queue + Summary Override | Urgency | Task `priority` (`POST /api/workfront/priority`) |
| `#` + grip + Apply order | Executive → Portfolio Optimization order | Completion/resource order | Project `portfolioPriority` (`GET`/`POST /api/workfront/portfolio`) |

Dragging a Request Queue row does **not** change P1–P3. Queue “order by Priority” means **sort by
urgency**, not Portfolio Optimizer ranks.

### Urgency map (provisional — admin may override)

| App | Workfront Task `priority` |
| --- | --- |
| P1 | `1` (Urgent) |
| P2 | `2` (High) |
| P3 | `4` (Low) |

Live create includes `priority`. Changing the queue select (or Summary Override) with kill switch on
and a Task ID confirms, then PATCHes the Task. Refresh still maps Workfront → local (decision 037).

### Portfolio Optimization drag UX

On Executive:

1. `#` column shows pending ordinal (1…n).
2. Grip: pointer drag, keyboard arrows, or arm grip → Move up / Move down (WCAG 2.5.7; reuse of
   decision 026 pattern).
3. **Apply order** commits contiguous ranks (Workfront Set Priority analogue). Drag alone only
   updates pending local order.
4. Requires `WORKFRONT_PORTFOLIO_ID` (TEST PORTFOLIO - CHRIS) on the proxy — never `VITE_*`.

## Preferred Workfront targets

### Reviewer Status

**Preferred:** native Task `status` on the request queue, with a status group aligned to:

- Needs review
- Needs clarification
- Escalated
- Approved
- Closed
- Deferred to backlog

That avoids inventing a custom A3 field. It needs Workfront admin configuration.

**Fallback (config request only):** custom form dropdown e.g. `A3IntakeReviewStatus` on the A3 Creative
Intake form. Do **not** add that name in client schema until the form actually has it.

### Executive dashboard

| Summary | Workfront source |
| --- | --- |
| Urgency counts P1–P3 | Local ready requests in this browser (aligned to Task priority when dual-written) |
| Portfolio project order | `portfolioPriority` for projects in `WORKFRONT_PORTFOLIO_ID` |
| Hours / capacity | Assignment `work` / `workRequired` / `percentComplete`; Resource Planner later |

Hours, capacity, turnaround, on-time %, reporting week, and the Completed work table still show
**labeled illustrative Concept v1 figures** where noted (guardrail 7). Decisions 034, 040, 045, 052.

## Open items for Workfront admin

1. Confirm whether native Task statuses can match the six reviewer labels, or a custom field is required.
2. Confirm or override the provisional P1→1 / P2→2 / P3→4 priority enum.
3. Supply `WORKFRONT_PORTFOLIO_ID` for TEST PORTFOLIO - CHRIS; confirm S2S Manage on portfolio projects for Apply order.
4. Vendor Management gate before any live hours / Resource Planner API.
