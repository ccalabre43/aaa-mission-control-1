# AAA Life brief artifacts — two real documents found in the folder

- **Discovered:** 16 Sep 2026, during the Sprint 0 consolidation scan
- **Status:** active, **new input not anticipated by the approved plan**
- **Files:** `docs/briefs/aaa-life-creative-brief-annuities-example.docx`,
  `docs/briefs/aaa-life-strategy-brief-template.docx`

These were in `knowledge:` and were not listed in the plan's design-source inventory. Per the
session-start documentation protocol, they are summarized here and their scope impact is stated
plainly. **Neither has been used to change the approved plan** — the A3 Creative Intake schema
remains the authoritative data model. Anything below marked as a proposal awaits confirmation.

---

## 1. Completed creative brief — Annuities content

A real, filled-in AAA Life creative brief. Document owner Sherry Rosenkranz, V1 dated
8 September 2026, project status Planning, prepared for the AAA Life Brand and Creative Services
team. Subject: a scalable annuity content library spanning education, consideration, lead
generation, and sales enablement across the annuity customer journey.

Its section structure, which is considerably deeper than the generic five-section template:

1. **Project summary and background** — with named sub-blocks for Business Challenge, Opportunity,
   and a Project-Specific Context block covering Business Need, Triggers, Market Conditions, and
   Sales Opportunity
2. **Objective and goals** — Primary Objective, Business Goals, Marketing and Communications Goals,
   and a **Measurement Framework table** organized by journey stage (Awareness, Engagement,
   Consideration, Lead/Conversion, Enablement), each with illustrative measures and an explicit
   "what we need to learn"
3. **Target audience** — primary and secondary audiences, a Core Audience Insight, and a list of
   audience questions the content must answer
4. **Messaging strategy**

Header metadata carried at the top: Prepared For, Document Owner, Version / Date, Project Status.

### Why this matters

This is the **output quality bar**. It shows what a finished AAA Life brief actually looks like, and
it is the best available reference for the prose that `TemplateAssistant` writes into the A3
paragraph fields. Three specifics are directly reusable:

- Goals are separated into **business goals** and **marketing/communications goals**. The A3 form
  has a single `A3IntakeGoalsExpectations` field, so the assistant should structure that field's
  prose along those two lines rather than producing one undifferentiated list.
- Measurement is expressed **per journey stage with a learning objective**, not as a flat list of
  KPIs. This is a strong template for `A3IntakeSuccessMeasurement`.
- Audience is expressed as life stage plus mindset plus "need from content" — a repeatable shape.

## 2. Strategy brief template — blank AAA Life form

The blank AAA Life strategy brief template. Its fields:

- **Project info:** Date of Brief, Project Name, Project Owner, Executive Sponsor, Business Area
  Representatives (the person from each impacted business area who must be engaged and approve)
- **Current situation / background:** Background ("what sparked this specific assignment?"),
  Impacted AAA Life Systems, Impacted Customer Touchpoints (for example eService platform, AAA Life
  website, Member Services processes and systems)
- **What are we solving for:** Hypothesis or Opportunity, and whether it is a brand, product, or
  consumer challenge
- **Goals and KPIs:** Metric of Success, Testing and Analysis
- **Audience:** Target Audience, Audience Insights, **Club / Geography** (national, or specific club
  or geographic audiences)
- **Messaging:** Consumer Takeaway, Key Messages, Proof Points
- **Additional details:** **Mandatories** ("is there anything we must include or avoid?"),
  Added-Value Priorities, Further Reading
- **Key milestone dates:** Timing (tied to a launch, event, or media buy), **Seasonality**
  (political, cultural, AEP, and similar key dates)

### Why this matters

This template asks for several things the A3 form does not, and they are not decorative — they are
the questions AAA Life's own process considers necessary:

| Field the A3 form lacks | Why it is load-bearing |
| --- | --- |
| Executive Sponsor, Business Area Representatives | Names the approvers. Directly relevant to the Sprint 2 reviewer gates |
| Impacted AAA Life Systems / Customer Touchpoints | Scope and dependency signal; also a strong matcher signal for overlap between teams |
| Club / Geography | AAA is a federation of clubs. National versus club-specific changes the whole audience definition |
| Mandatories | Where disclaimers and prohibited language live — a compliance-flag trigger |
| Seasonality (including AEP) | Annual Enrollment Period timing is a real deadline constraint, not a nice-to-have |

---

## Scope impact — stated plainly

**Does not change** the A3 Creative Intake schema, the nine guided questions, the ALAN number
handling, the matcher design, or any screen. The A3 form's internal field names remain the only
thing Workfront will accept, and the app does not invent Workfront fields.

**Does change nothing yet, but is worth deciding.** Three proposals, none applied:

1. **Custom questions as the mechanism, not a schema change.** Club/Geography, Impacted Systems and
   Touchpoints, Mandatories, and Seasonality all fit the existing custom-question feature, appended
   into `A3IntakeSupplementalDescription` with their question text as a label. That needs no
   Workfront admin change. Recommended as a default question-set addition for review.
2. **`TemplateAssistant` prose shape.** Use the annuities brief's structure for the paragraph
   fields — split goals into business versus marketing, and structure measurement by journey stage.
   This is a copy and assembly decision, invisible to the schema.
3. **Two brief types, eventually.** The source requirements name "creative brief, strategy brief,
   proposal, technical specs, decision docs." These two documents confirm creative and strategy
   briefs are genuinely different forms at AAA Life, not one form with different content. A brief
   type selector belongs in a later sprint, not bolted onto Sprint 1.

**Blocker it partially relieves.** The plan lists the AAA Life Language Guide as a missing blocker
constraining brief voice. The completed annuities brief is a usable voice sample in the meantime,
though it is one artifact and not a style authority.
