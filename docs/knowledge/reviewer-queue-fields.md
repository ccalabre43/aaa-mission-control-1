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
| Channels | Display tokens parsed from `A3IntakeDeliverables` | Same custom field (paragraph on the A3 form) |
| Status | `brief.reviewer.status` (local) | Native Issue `status` with a request-queue status group, **or** custom dropdown if native cannot match |
| Priority | `brief.reviewer.priority` (local) | Native Issue `priority` (map P1/P2/P3 to High/Normal/Low — confirm labels) |
| Entry Date | `submittedAt` or `createdAt` | Issue `entryDate` |
| Requestor | Identity name + initials (no email in the table) | `A3IntakeRequestedBy`; Entered By under S2S is the tech account |
| NEW badge | Submitted/ready and `reviewer.firstReviewedAt` is null | Derived from entry date + status; no new field |
| Impact / Effort / Risk | `brief.reviewer.impact` / `effort` / `risk` (local High/Medium/Low) | No A3 field yet; possible custom dropdowns later as a Workfront config request only |

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

Until then, the Executive tab uses the Concept v1 2×3 layout (`assets/mocks/executive-dashboard-concept-v1.png`).
Queue counts and escalations come from **this browser’s saved requests**; tracker “jobs in motion”
from `aaa-project-tracker`. Hours, capacity, turnaround, and on-time % are labeled placeholders — not
Workfront Resource Planner, and not organization-wide (guardrail 7). Decision 034.

## Open items for Workfront admin

1. Confirm whether native Issue statuses can match the six reviewer labels, or a custom field is required.
2. Confirm priority enum labels for P1–P3.
3. Vendor Management gate before any live hours / Resource Planner API.
