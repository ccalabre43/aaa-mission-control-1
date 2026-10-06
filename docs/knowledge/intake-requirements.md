# Intake requirements (original brief from the requester)

- **Source:** `intake-text-sept14.rtf`, dated 14 Sep 2026
- **Converted:** 16 Sep 2026 — Markdown is now canonical; the RTF is retained in `docs/knowledge/source-originals/` for provenance
- **Status:** active. This is the founding statement of intent for the product.

> Converted verbatim in substance. Wording is preserved except where the standing copy-correction
> rule applies (spelling, capitalization, and brand spellings such as Workfront and Monday.com).
> Nothing that changes meaning has been altered.

## Name

Intake brief co-creation dashboard and tool

## Description

Create a web app dashboard with a workflow and tool that guides users through a structured
workflow for co-authoring a work intake for creative work within a marketing department. The
intake is meant to be AI-assisted conversational context gathering between the user and the LLM.
Information is gathered and collected in a review UI dashboard that will eventually be connected
via API to Adobe Workfront.

The workflow helps users efficiently organize, create, and transfer context through a sequence of
context-gathering questions. The collected information is then used to create an intake queue
entry, submitted to an Adobe Workfront job intake queue for prioritization and execution.

## Stated requirements

- Human-in-the-loop exit conditions where user input is needed.
- The intake form is conversational, built from relevant questions that gather the context needed
  to create a creative brief for a marketing team.
- Allow the user to validate with fresh perspective.
- Screenshots and other documents in the project folder are provided to help visualize this.
- Help defining and creating a reusable workflow with human-in-the-loop checkpoints.
- Applies when a user wants to create a creative brief, strategy brief, proposal, technical specs,
  decision docs, or similar structured content.
- The agent should check the folder structure for more information as needed.
- The dashboard has an easy-to-use requester flow and a reviewer mode, to approve, reject, or send
  to the Workfront queue.

## Reference links supplied

- [Adobe Workfront Planning API basics](https://experienceleague.adobe.com/en/docs/workfront/using/adobe-workfront-planning/adobe-workfront-planning-general-information/planning-api-basics)
- [Adobe Workfront document webhooks overview](https://experienceleague.adobe.com/en/docs/workfront/using/adobe-workfront-api/document-webhooks-api/webhooks-overview)
- [Monday.com API reference](https://developer.monday.com/api-reference/reference/about-the-api-reference)

## Explicitly deferred to later phases

- Integration into other workflows such as Monday.com and similar software.
- Additional dashboard homepage tools: an Analytics button, a Sales Enablement button, and an
  AAA Reference Library.

## How this maps to the current plan

| Requirement | Where it lands |
| --- | --- |
| Conversational, one-question-at-a-time intake | Sprint 1 guided questions, driven by the question registry |
| Human-in-the-loop checkpoints | Sprint 1 Related activity step and Review draft step |
| Review UI with fresh-perspective validation | Sprint 1 Review draft (read mode by default, inline edit toggle) |
| Workfront queue submission | Sprint 1 ships the payload shape and a local stub; live OAuth is a later vendor-gated step |
| Reviewer mode (approve, reject, send to queue) | Sprint 2, designed from `reviewer-ux-flow.jpg` |
| Monday.com, Analytics, Sales Enablement, Reference Library | Later phases, per the source |
