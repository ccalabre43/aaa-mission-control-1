# Requester and reviewer flows (skill definition)

- **Source:** `OVERALL-skill.rtf`
- **Converted:** 16 Sep 2026 — Markdown is now canonical; the RTF is retained in `docs/knowledge/source-originals/`
- **Status:** active. Read alongside `assets/mocks/requestor-ux-flow.jpg` and
  `assets/mocks/reviewer-ux-flow.jpg`, which are the authoritative state machines.

> Converted verbatim in substance, with the standing copy-correction rule applied: `que` is
> corrected to **queue** throughout, and Workfront and Monday.com use their brand spellings.

## Skill metadata as authored

- **name:** smart-intake-request
- **description:** Use this skill when a user creates a work request. Make the request compatible
  for Adobe Workfront and Monday.com upload.
- **author:** marketing-department
- **version:** 1.0

## Requester flow

1. System ready: load skills, guardrails, and knowledge.
2. Voice, text, or attachment used to input the creative brief.
3. Smart brief suggests new recommendations, plus in-flight or previously related projects.
4. Guided questions, one at a time, with required fields.
5. System flags anything that might need compliance review or additional information.
6. Related projects and activity are recognized, the user is notified, and human-in-the-loop is
   asked to step in.
7. All is good: generate the brief for the review pane.
8. Human-in-the-loop is asked to review the draft, or send it to additional reviewers.
9. Draft is confirmed: sent to the reviewable queue, and also to Adobe Workfront.
10. Success notification, then start another request.

## Reviewer flow

1. Queue is refreshed and shows a short summary of each job in the queue.
2. On selection, details open; tasks can be arranged by priority and date.
3. System checks and flags anything that might need compliance review or additional information,
   for a second time.
4. Human-in-the-loop: approve or flag (a job can be sent back or deferred here).
5. If not flagged, the job appears in the "jobs in motion" queue — Adobe Workfront integration.
6. Any job's queue status can be viewed (Adobe Workfront integration). Approved jobs in the queue
   are also loaded into Adobe Workfront on submission.
7. Data analysis: workload and capacity information and jobs-in-motion information can be viewed on
   a separate job status view, or a current workload breakdown view.
8. Job board status can be viewed, downloaded, and shared with any team or team member.

## Design principles called out in the source

- Domain expertise
- New capabilities
- Repeatable workflows
- Interoperability: reuse the same skill across different skills-compatible agent products

## Sprint coverage

| Source step | Status |
| --- | --- |
| Requester steps 2–4, 7–10 | Sprint 1 |
| Requester step 3 (related and in-flight projects) | Sprint 1, `LocalMatcher` running live during the questions |
| Requester steps 5–6 (compliance flags, HITL) | Sprint 1 Related activity step; `complianceFlags` first-class on the brief |
| Voice input | Later phase |
| Send to additional reviewers | Sprint 2 |
| Entire reviewer flow | Sprint 2, designed not built |
| Workload and capacity views | Later phase |
