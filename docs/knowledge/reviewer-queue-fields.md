# Reviewer queue fields and Workfront mapping

- **Status:** active for local reviewer UI; Workfront write of these fields is not enabled
- **UI source:** `assets/mocks/request-queue-reviewer-interface.png`,
  `assets/mocks/request-summary-page.png`
- **Related:** `docs/workfront-auth.md`, `docs/knowledge/a3-schema.md`, decision 030

The Mission Control Request Queue is reviewer-styled but still a **request list** aimed at the
Workfront queue project `mission-control-v1`. Local reviewer Status and Priority are editable in the
app now. They are **not** added to `a3Schema.ts` and are **not** posted by `buildWorkfrontPayload`
until a Workfront admin confirms the targets below.

## Column sources today

| UI column | App source now | Later Workfront |
| --- | --- | --- |
| Subject | Issue name from `buildWorkfrontPayload` / `briefTitle` | Issue `name` |
| Channels | Removed from the Request Queue table; still used in search via `A3IntakeDeliverables` tokens | Same custom field (paragraph on the A3 form) |
| Status | `brief.reviewer.status` (local) | Native Issue `status` with a request-queue status group, **or** custom dropdown if native cannot match |
| Priority | `brief.reviewer.priority` (local) | Native Issue `priority` (map P1/P2/P3 to High/Normal/Low — confirm labels) |
| Entry Date | `submittedAt` or `createdAt` | Issue `entryDate` |
| Requestor | Identity name + initials (no email in the table) | `A3IntakeRequestedBy`; Entered By under S2S is the tech account |
| NEW badge | Submitted/ready and `reviewer.firstReviewedAt` is null | Derived from entry date + status; no new field |
| Size | `brief.reviewer.size` (local S/M/L; default M) | No A3 field; Summary triage only (Concept v1). Not posted to Workfront |
| Impact / Effort / Risk | `brief.reviewer.impact` / `effort` / `risk` (local High/Medium/Low) | No A3 field yet; possible custom dropdowns later as a Workfront config request only |

Summary’s two-column brief card (Concept v1 labels) is local display: `buildSummaryBriefFields`
reads `brief.a3` then falls back to `answers` / `contextText` (decision 042). It does not change
the Workfront payload.

## Preferred Workfront targets

### Reviewer Status

**Preferred:** native Issue `status` on the request queue, with a status group aligned to:

- Needs review
- Needs clarification
- Escalated
- Approved
- Closed
- Deferred to backlog

That avoids inventing a custom A3 field. It needs Workfront admin configuration.

**Fallback (config request only):** custom form dropdown e.g. `A3IntakeReviewStatus` on the A3 Creative
Intake form. Do **not** add that name in client schema until the form actually has it.

### Priority

**Preferred:** native Issue `priority`. Suggested mapping pending admin confirmation:

| App | Workfront priority (typical) |
| --- | --- |
| P1 | Urgent or High |
| P2 | Normal |
| P3 | Low |

### Executive dashboard (later live data)

| Summary | Workfront source |
| --- | --- |
| Workload counts | Issue search by `status`, `priority`, `queueTopicID`, `assignedToID` on project `6abae2b600041e3ecb6a8da4dbe7b4a1` |
| Hours / capacity | Assignment `work` / `workRequired` / `percentComplete`; Resource Planner later |

Until a Workfront feed is approved, the Executive tab follows Concept v1 **Executive dashboard 2**
(Figma node `469-7289`; earlier 2×3 still in `assets/mocks/executive-dashboard-concept-v1.png`).
Queue counts and escalations come from **this browser’s saved requests**; tracker “jobs in motion”
from `aaa-project-tracker`. Hours, capacity, turnaround, on-time %, reporting week, and the
Selected status / Completed work tables show **labeled illustrative Concept v1 figures** (not
Workfront Resource Planner, not organization-wide — guardrail 7). Decisions 034, 040, 045.

## Open items for Workfront admin

1. Confirm whether native Issue statuses can match the six reviewer labels, or a custom field is required.
2. Confirm priority enum labels for P1–P3.
3. Vendor Management gate before any live hours / Resource Planner API.
