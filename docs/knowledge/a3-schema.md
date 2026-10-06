# A3 Creative Intake schema

- **Source:** `assets/mocks/intake-brief-example.jpg` — a UI rendering of the real Workfront
  Issue/Request custom form, with internal `Name` values visible in the gray captions
- **Encoded in:** `src/lib/intake/a3Schema.ts`
- **Status:** active and authoritative for anything Workfront-bound
- **Last verified:** 16 Sep 2026

This supersedes the generic five-section brief in `docs/briefs/creative-brief-template.md`. The
internal names below **are the contract**. They are not stylistic choices, and renaming one to
something friendlier breaks submission.

**The app never invents a Workfront field.** If information has no home here, it goes into the Issue
description as a labeled audit line and is raised as a Workfront configuration request. It is not
added to this schema.

## The form

Eight sections, in the order drawn. An asterisk means required, which gates submission.

| Section | Label | Internal name | Type | Req |
| --- | --- | --- | --- | :-: |
| Introduction | How to use this intake form | `A3IntakeFormIntro` | Descriptive text | |
| Requester | Requested By | `A3IntakeRequestedBy` | Single line text | * |
| General information | Communication Type | `A3IntakeCommunicationType` | Radio buttons | * |
| General information | Additional Information | `A3IntakeAdditionalInformation` | Paragraph | |
| Background and project details | Background and Business Purposes | `A3IntakeBackgroundPurpose` | Paragraph | * |
| Background and project details | Project Summary | `A3IntakeProjectSummary` | Paragraph | * |
| Deliverables and outcomes | Deliverables | `A3IntakeDeliverables` | Paragraph | * |
| Deliverables and outcomes | Goals and Expectations | `A3IntakeGoalsExpectations` | Paragraph | |
| Deliverables and outcomes | Success Measurement | `A3IntakeSuccessMeasurement` | Paragraph | |
| Project timing | Desired Project Completion Date | `A3IntakeDesiredCompletionDate` | Date | * |
| Project timing | Project Timing Information | `A3IntakeTimingNotes` | Paragraph | |
| Additional information | Additional Information Description | `A3IntakeSupplementalDescription` | Paragraph | |
| Attachments | Supporting files | `A3IntakeSupportingFiles` | Images, PDFs, videos | |

`A3IntakeCommunicationType` has exactly two options: **Corporate Communications** and **Brand
Creative Services**.

It is a **radio field, so Workfront accepts exactly one of them.** The app nevertheless lets a
requester choose both, because a request can genuinely need internal communications and marketing
creative. That is a deliberate divergence from the field's arity, dated in
`docs/decisions/decision-log.md`, and it is the reason a two-team answer also appears as an audit
line in the Issue description. Converting this field to a checkbox group is an open Workfront
configuration request; until it lands, assume Workfront may keep only the first value and treat the
description line as the authoritative record.

Multi-value answers are stored as a comma-joined string in the field's own option order, never click
order, so the same two choices always produce the same value. `parseOptionValues` validates each
token against the real option list, so a hand-edited value cannot introduce an option Workfront does
not offer.

`A3IntakeFormIntro` is display-only and never submitted. Its copy on the real form reads: "Complete
all sections. Values map to the Workfront Issue / Request custom form. Required fields are marked
with an asterisk."

## The nine guided questions

Identity is captured on the Start screen and attachments in the Context step, so the guided set maps
onto the remaining fields one-to-one.

| # | Question | Target field |
| --- | --- | --- |
| 1 | What are you trying to accomplish? | `A3IntakeBackgroundPurpose` |
| 2 | Project summary | `A3IntakeProjectSummary` |
| 3 | Communication type | `A3IntakeCommunicationType` |
| 4 | Deliverables | `A3IntakeDeliverables` |
| 5 | Goals and expectations | `A3IntakeGoalsExpectations` |
| 6 | Success measurement | `A3IntakeSuccessMeasurement` |
| 7 | Desired completion date | `A3IntakeDesiredCompletionDate` |
| 8 | Timing information | `A3IntakeTimingNotes` |
| 9 | Anything else | `A3IntakeAdditionalInformation` and `A3IntakeSupplementalDescription` |

Question 1's wording is taken verbatim from `creative-request-guided-questions-interface.png`.

**This mapping is a derivation, not a given.** The form's own footer cites
`a3-creative-intake-workfront-mapping.csv` as the authority for Workfront types and internal names,
and that file has not been provided. Two things limit the damage of getting it wrong:

1. The question count is driven by the registry in `src/lib/intake/questionRegistry.ts`, not
   hard-coded, so "Question 1 of 9" becomes "Question 1 of N" automatically.
2. `src/lib/intake/a3Schema.ts` is the single place a CSV difference changes. A correction becomes a
   data edit rather than a component rewrite.

## Locked versus editable questions

The six required fields gate submission, so their questions cannot be removed. Only their wording is
editable.

- `A3IntakeRequestedBy` is collected on the Start screen, not as a question.
- `A3IntakeCommunicationType` renders as a choice group and `A3IntakeDesiredCompletionDate` as a date
  picker — not as textareas. Whether the choice group allows one answer or several is set per
  question in the admin view; the shipped default is several. A question over an option-bearing field
  can never be a free-text box, because that would let a requester type a value Workfront does not
  offer.
- The five optional fields (`A3IntakeAdditionalInformation`, `A3IntakeGoalsExpectations`,
  `A3IntakeSuccessMeasurement`, `A3IntakeTimingNotes`, `A3IntakeSupplementalDescription`) can be
  toggled off or reordered freely.

The **ALAN number is deliberately not in the registry.** It belongs to the Context step's upload area,
which keeps the guided set at nine as the mock draws it.

## Custom questions

A custom question targets either an existing A3 field or appends into
`A3IntakeSupplementalDescription`, labeled with the question text so a producer reading the Workfront
Issue still knows what was asked. Adding a question therefore never requires a Workfront admin
change. If a custom question genuinely needs its own field, that is raised as a Workfront
configuration request rather than pretended into the payload.

## What has no field, and rides in the description

Both are flagged as Workfront configuration requests in `docs/decisions/decision-log.md`.

| Data | Why it has no field | Where it goes |
| --- | --- | --- |
| **ALAN number** | Not present anywhere in the A3 form | Prefixed to the Issue name, and an audit line in the description |
| **Match coverage** | Not present, and newly introduced | An audit line stating what the duplicate check actually covered |
| **A second communication type** | `A3IntakeCommunicationType` is a radio and holds one value | An audit line naming every team selected, so routing survives even if Workfront collapses the value |
| Resolved duplicates and related work | Not present | Audit lines |
| Compliance flags | Not present | Audit line; first-class on the brief for the Sprint 2 reviewer |

The coverage line matters more than it looks. Without it, a brief checked against one browser's
history is indistinguishable from one checked against the entire Workfront queue, and a reviewer
would extend trust the record does not deserve.

## Queue topics: the part of routing that is not a custom form field

The schema doc originally had no notion of a queue topic, which made team routing look like a custom
field problem. It is not. **Workfront does not route a request with a custom-form value.** It routes
with a **queue topic** carrying a **routing rule**, and the topic's position under its queue and topic
groups is the `Path` column in the Submitted Requests list.

That distinction is why a two-team answer was awkward for so long. `A3IntakeCommunicationType` is a
radio and holds one value; two topics with two routing rules is ordinary Workfront configuration.

| Object | Code | What it is | Where it lives here |
| --- | --- | --- | --- |
| `QueueDef` | QUED | The project designated as a request queue | `src/lib/workfront/queueConfig.ts` |
| `QueueTopicGroup` | QUETGP | Optional grouping layer, nestable up to 10 deep in Workfront | same |
| `QueueTopic` | QUET | What a requester picks; carries the routing rule | same |
| `RoutingRule` | — | **One** default assignee and **one** default team | same |

A brief stores `queueTopicId`, set at the Generating step by matching its Communication Type answers
against each topic's `communicationTypes` **as an exact set**. Exact-set matching is the point: a
"contains" match would route a two-team request into whichever single-team topic came first and look
entirely successful.

Three consequences worth stating plainly:

- **The requester never picks a topic.** They answer which team should handle the work, in their own
  vocabulary, and the topic is derived. Asking for both would be the same decision twice.
- **A two-team answer routes to one triage topic**, not to two issues. Two issues would duplicate the
  work, and this app's own duplicate detection would then flag the pair it had just created.
- **Every `workfrontID` is blank until a Workfront administrator supplies it**, and a topic without one
  cannot be submitted against. `sendBlockers` names each missing ID; the Request Queue shows them per
  row. This is why the queue can assemble a complete payload and still refuse to send it.

Briefs saved before `queueTopicId` existed have none. `routeFor` derives a route for those at read
time and marks it `derived`, and the UI says so — an inferred route is a weaker claim than a recorded
one, and collapsing the two would misrepresent what the app knows.

## Workfront payload shape

`src/lib/workfront/submitToWorkfront.ts` builds a Workfront Issue:

```ts
{
  name: "ALAN-29541-624-00 - Limited-time term life rate promotion",
  description: "<audit lines>\n\n---\n\n<labeled field bodies>",
  plannedCompletionDate: "2026-10-31",   // from A3IntakeDesiredCompletionDate
  customForm: { A3IntakeBackgroundPurpose: "...", /* keyed by internal name */ },
  attachmentNames: ["rate-sheet.pdf"],
  queueTopicID: "",                      // blank until a Workfront admin supplies it
  projectID: "",                         // the queue IS a project in Workfront
  opTaskType: "Request"                  // a real Workfront Request Type
}
```

Three real OPTASK fields are deliberately **not** populated:

| Field | Why not |
| --- | --- |
| `referenceNumber` | Assigned by Workfront on creation. A local value would be a fabricated identifier the UI then displays as fact |
| `enteredByID` | Assigned server-side from the authenticated identity, which is unsettled — see `docs/workfront-auth.md` |
| `priority` | No requester-facing priority question exists, and the issue priority enum is unverified against the API Explorer |

Because `customForm` is keyed by internal name, the live adapter becomes an HTTP call rather than a
remapping exercise. `submitToWorkfront` validates the six required fields and always returns
`mode: "local"`, alongside `readyToSend: false` and a `blockers` list. **It makes no network call.**

`readyToSend` is deliberately separate from `ok`. `ok` is about the requester's work being complete;
`readyToSend` is about the queue being configured. Conflating them would mean an unconfigured queue
stopped people from saving their own requests, and there is no server copy to save them elsewhere.

Going live needs OAuth via Adobe Developer Console, which is a Vendor Management and privacy gate.
See `docs/workfront-auth.md` for why every currently available option is either retiring or forbidden
in a browser-only app.

## Attachments

Only metadata is stored — file name, size, MIME type. File contents are deliberately not persisted:
base64 in `localStorage` would exhaust the roughly 5MB quota on a single PDF and take the user's
drafts down with it. Real upload is a separate Workfront document call when submission goes live.
