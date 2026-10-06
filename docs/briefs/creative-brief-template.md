# Creative brief template (generic five-section)

- **Source:** `projectbrief-sample.rtfd/TXT.rtf`
- **Converted:** 16 Sep 2026 — the RTFD bundle is retained in `docs/knowledge/source-originals/`
- **Status:** active as a reference, **not** authoritative for Workfront.

> **Authority note.** `docs/knowledge/a3-schema.md` is the authoritative data model for anything
> submitted to Workfront, because it carries the real internal field names from the A3 Creative
> Intake custom form. This template is a generic structure kept for reference and for shaping the
> narrative prose the assistant writes into the A3 paragraph fields.

## Creative brief: [Project name]

### 1. Project overview

- **Background:** [What is the business situation or origin?]
- **Objective:** [What specific action do we want the user to take?]

### 2. Target audience

- **Who they are:** [Demographics and role]
- **Their pain point:** [What problem are they trying to solve?]

### 3. Core message

- **Single-minded promise:** [The main benefit or solution]
- **Reasons to believe:** [Proof points or features]

### 4. Tone and style

- **Voice:** [Three adjectives describing the tone, for example: bold, helpful, direct]
- **Mandatories:** [Logos, disclaimers, or words to avoid]

### 5. Deliverables and timeline

- **Assets:** [List of formats, for example: 3 static image ads, 1 landing page]
- **Deadline:** [Date final assets are due]

## Mapping onto the A3 Creative Intake form

| Generic section | A3 field |
| --- | --- |
| Background | `A3IntakeBackgroundPurpose` |
| Objective, core message | `A3IntakeProjectSummary` |
| Target audience, reasons to believe | `A3IntakeProjectSummary`, `A3IntakeSupplementalDescription` |
| Tone and style, mandatories | `A3IntakeSupplementalDescription` |
| Assets | `A3IntakeDeliverables` |
| Deadline | `A3IntakeDesiredCompletionDate` |
| Measurement (absent here) | `A3IntakeSuccessMeasurement` |

The generic template has no measurement section, which is one reason the A3 form supersedes it:
`A3IntakeGoalsExpectations` and `A3IntakeSuccessMeasurement` are fields a producer expects to see.

## Related real AAA Life artifacts

Two genuine AAA Life brief documents live alongside this template and are richer references:

- `aaa-life-creative-brief-annuities-example.docx` — a completed creative brief
- `aaa-life-strategy-brief-template.docx` — the blank AAA Life strategy brief template

See `docs/knowledge/aaa-life-brief-artifacts.md` for what they contain and what they imply.
