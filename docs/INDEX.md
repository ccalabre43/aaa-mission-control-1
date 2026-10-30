# Documentation manifest

Every document and design asset in this project, with what it is and whether it is still current.
**Start here.** If a file is not listed, it is new and needs to be read, summarized, and added.

- **Last full scan:** 28 Oct 2026 (Executive dashboard 2, Figma 469-7289)
- **Protocol:** see the session-start scan in `.cursor/rules/intake-project.mdc`

Status values: **active**, **reference** (kept for provenance, not authoritative), **superseded**,
**blocked-missing** (expected but not present).

## How to run the scan

1. Scan `docs/` and `assets/` newest first, **by explicit path as well as by pattern**. A directory
   listing can miss files that are really there - this happened with the brand PDF and every design
   asset, which were invisible to pattern searches because of a colon in the folder name.
2. Diff against this table. Anything unlisted is new.
3. Read what is new and summarize it in a sentence or two. State plainly whether it changes scope, a
   guardrail, or nothing.
4. If it changes scope or a guardrail, **propose the change and wait for confirmation.** New
   documentation never silently rewrites an approved plan.
5. Update this table. Append to `docs/decisions/decision-log.md` if a decision resulted.

---

## Authoritative sources

These govern. When something else disagrees with one of these, these win.

| Path | Added | What it is | Status |
| --- | --- | --- | --- |
| `docs/knowledge/a3-schema.md` | 2026-09-16 | The A3 Creative Intake data model with real Workfront internal field names. **The only thing Workfront will accept.** | active |
| `assets/mocks/intake-brief-example.jpg` | 2026-09-16 | UI rendering of the real Workfront Issue custom form, internal `Name` values visible. Source of the schema above | active |
| `assets/mocks/requestor-ux-flow.jpg` | 2026-09-16 | The requester state machine. Authoritative for flow and back edges | active |
| `assets/mocks/reviewer-ux-flow.jpg` | 2026-09-16 | The reviewer state machine. Sprint 2 | active |
| `assets/brand/AAAL-Brand-Visual-Style-Guide.pdf` | 2026-09-16 | Brand system, MAR 2025. Proprietary, internal use only | active |
| `docs/knowledge/brand-system.md` | 2026-09-16 | The brand guide as actually implemented, with every ratio computed. Records six places the guide's own ADA guidance fails when measured | active |
| `docs/decisions/decision-log.md` | 2026-09-16; 037 Refresh upsert 2026-10-07; Vercel WF 048 / mobile logo 049 / home list 050 / brief decipher + docs 051 2026-10-30 | Dated decisions, brand exceptions, guardrail changes, and open items | active |

## Requirements and flows

| Path | Added | What it is | Status |
| --- | --- | --- | --- |
| `docs/knowledge/intake-requirements.md` | 2026-09-16 | The founding statement of intent, converted from `intake-text-sept14.rtf`. Includes what was explicitly deferred | active |
| `docs/knowledge/requestor-reviewer-flows.md` | 2026-09-16 | The `smart-intake-request` skill definition: requester and reviewer flows step by step, converted from `OVERALL-skill.rtf` | active |
| `docs/knowledge/references.md` | 2026-09-16 | External links, extracted from `.webloc` bookmarks. Workfront APIs, Monday.com, NN/g | active |

## Briefs

| Path | Added | What it is | Status |
| --- | --- | --- | --- |
| `docs/briefs/aaa-life-creative-brief-annuities-example.docx` | 2026-09-16 | A **real completed** AAA Life creative brief (Annuities). The output quality bar | active |
| `docs/briefs/aaa-life-strategy-brief-template.docx` | 2026-09-16 | The blank AAA Life **strategy** brief template. Asks for several things the A3 form does not | active |
| `docs/knowledge/aaa-life-brief-artifacts.md` | 2026-09-16 | What those two documents contain and what they imply. **Three proposals awaiting a decision** | active |
| `docs/briefs/creative-brief-template.md` | 2026-09-16 | Generic five-section brief template. Superseded by the A3 schema for anything Workfront-bound | reference |

## Brand assets

| Path | Added | What it is | Status |
| --- | --- | --- | --- |
| `assets/brand/README.md` | 2026-09-16 | How the logo derivatives were produced, and their two caveats | active |
| `assets/brand/aaa-life-logo-2color.eps` | 2026-09-16 | Print master, 2-color. Browsers cannot render EPS | active |
| `assets/brand/aaa-life-logo-white.eps` | 2026-09-16 | Print master, reversed white | active |
| `assets/brand/aaa-life-logo-2color-web.png` | 2026-09-16 | Web derivative, clear space baked in. **Color-approximate**, interim | active |
| `assets/brand/aaa-life-logo-white-web.png` | 2026-09-16 | Web derivative. Pure white, so color-exact | active |

## Design mocks

| Path | Added | What it is | Status |
| --- | --- | --- | --- |
| `assets/mocks/main-dashboard-interface.png` | 2026-09-16 | Desktop home, four tool cards. Contains the `Misson` typo, corrected in shipped copy | active |
| `assets/mocks/main-mobile-dashboard-interface.png` | 2026-09-16 | Mobile home, 2x2 cards on the pale blue wash plus a Start request button | active |
| `assets/mocks/creative-request-interface.png` | 2026-09-16 | Step 1, identity capture | active |
| `assets/mocks/creative-request-context-interface.png` | 2026-09-16 | Step 2, free-text context plus the attachment dropzone | active |
| `assets/mocks/creative-request-guided-questions-interface.png` | 2026-09-16 | Step 3, one question of nine with a progress bar | active |
| `assets/mocks/request-queue-reviewer-interface.png` | 2026-10-04 | Reviewer-style Request queue: Subject, Channels, Status, Priority, Entry Date, Requestor; page tabs for Request queue and Executive dashboard | active |
| `assets/mocks/executive-dashboard-concept-v1.png` | 2026-10-06; layout ref 2026-10-28 | Earlier Concept v1 2×3 still; live layout is Figma **469-7289** Executive dashboard 2 (decision 045). Hours/tables remain illustrative | active |
| `assets/mocks/sent-to-workfront-modal.png` | 2026-10-07 | Success modal after Submit to Workfront Que (Figma AAA Life proto node 544:1645). Ships only when a real Issue ID returns | active |
| `assets/mocks/request-summary-page.png` | 2026-10-13 | Request Summary Concept v1 (Figma node 369-5482): Size + Impact + Effort + Risk; Accept — Send to Workfront | active |
| `docs/knowledge/reviewer-queue-fields.md` | 2026-10-04; exec 2026-10-06; demo 2026-10-13; Size 2026-10-13; Summary display 2026-10-13; exec 2 2026-10-28 | Local reviewer Status/Priority/Size/Impact/Effort/Risk and preferred Workfront field map; Summary brief-card A3→answers fallback (042); Executive dashboard 2 / demo tables (034, 040, 045) | active |
| `docs/knowledge/deep-dive-excel.md` | 2026-10-27; proxy 2026-10-29; preferred OAuth identity 2026-10-29 | BrandIntegratedMarketing SharePoint Excel SoR; preferred sign-in `p92654@aaalife.com` (047); Graph ids pending Composio Active; deep-dive-proxy + kill switch (044, 046) | active — discovery; live ids pending auth |
| `deep-dive-proxy/README.md` | 2026-10-29 | Local Graph proxy for Deep Dive slots/book; `DEEP_DIVE_LIVE_WRITE` kill switch | active |

No mock exists for Related activity, Generating, Review draft, Confirmed, or the Manage questions
admin view. Those five surfaces are built from established patterns and are **flagged for review**
rather than treated as designed. The Request Queue list itself now has a reviewer mock (above).

## Audits

| Path | Added | What it is | Status |
| --- | --- | --- | --- |
| `docs/audits/aaalife-design-sprint.md` | moved 2026-09-16 | Existing AAA Life design sprint audit | reference |
| `docs/audits/aaalife-homepage-fixes.md` | moved 2026-09-16 | Existing AAA Life homepage fixes audit | reference |

## Provenance and originals

Kept so nothing is lost. Not authoritative, and not to be edited.

| Path | Added | What it is | Status |
| --- | --- | --- | --- |
| `docs/knowledge/transcripts/ux-agent-skill.md` | 2026-09-16 | Chat transcript kept for provenance | reference |
| `docs/knowledge/transcripts/create-marketing-team-claude2.md` | 2026-09-16 | Chat transcript kept for provenance | reference |
| `docs/knowledge/source-originals/intake-text-sept14.rtf` | 2026-09-16 | RTF original of the requirements | superseded |
| `docs/knowledge/source-originals/OVERALL-skill.rtf` | 2026-09-16 | RTF original of the flows | superseded |
| `docs/knowledge/source-originals/projectbrief-sample.rtfd/` | 2026-09-16 | RTFD original of the generic brief template | superseded |
| `docs/knowledge/archive/verify-live-ux-SKILL-duplicate.md` | 2026-09-16 | Stray copy of the skill. `.cursor/skills/verify-live-ux/SKILL.md` is canonical | superseded |

## Deployment and verification

| Path | Added | What it is | Status |
| --- | --- | --- | --- |
| `docs/deployment.md` | 2026-09-16; Vercel `/api/workfront` 2026-10-30 | How to build and host: `APP_BASE_PATH`, per-host history fallback, security headers, Vercel Workfront env, what hosting does **not** solve | active |
| `docs/workfront-auth.md` | 2026-09-16; Step 4 2026-10-04; dual-write 2026-10-07; Refresh upsert 2026-10-07 | S2S + App Builder proxy; Task create/list; Refresh upserts into local queue (035–037) | active — Task dual-write; S2S Add Task ACL pending |
| `docs/knowledge/workfront-submit-walkthrough.md` | 2026-10-07; upsert 2026-10-07; ACL gate 2026-10-09; docs upload + brief decipher 2026-10-30 | Local Ready-to-send; dual-write Task + document upload to Task Docs and project Tasks folder; Context brief decipher; Refresh upsert; S2S Add Tasks/Documents ACL | active |
| `docs/knowledge/workfront-add-tasks-acl.md` | 2026-10-09 | S2S Access Level + project Share for Task create (resolved; decision 039) | active — create verified |
| `workfront-proxy/README.md` | 2026-10-04 | How to set Runtime secrets, deploy the health action, and run the local stand-in | active |
| `.env.example` | 2026-09-16; proxy URL 2026-10-04 | `APP_BASE_PATH`, public `WORKFRONT_PROXY_URL`, and the standing warning about `VITE_`-prefixed secrets | active |
| `vercel.json` | 2026-09-16 | Vercel rewrite, headers, caching. Repo root because that is where Vercel reads it | active |
| `public/_redirects`, `public/_headers` | 2026-09-16 | Netlify fallback and headers. `_headers` carries the canonical policy the other configs mirror | active |
| `public/staticwebapp.config.json` | 2026-09-16 | Azure Static Web Apps navigation fallback and global headers | active |
| `public/web.config` | 2026-09-16 | IIS. Needs the URL Rewrite module; also fixes the missing woff2 MIME type | active |
| `public/.htaccess` | 2026-09-16 | Apache. Needs `mod_rewrite` and `AllowOverride FileInfo`, or it is ignored silently | active |
| `public/robots.txt` | 2026-09-16 | Asks crawlers not to index. States plainly that it is not access control | active |
| `scripts/verify-flow.mjs` | 2026-09-16 | Walks all seven screens at two widths. Computes contrast from resolved CSS, checks focus rings, keyboard path, reduced motion, stepper progression, and the auditable-negative rule | active |
| `scripts/probe-csp.mjs` | 2026-09-16 | Exercises the app under the production CSP. Found the font-inlining break that review missed | active |
| `scripts/lib/copy-guard.mjs` | 2026-09-16 | The banned-phrase and coverage-disclosure checks, taking a directory so they can be tested | active |
| `scripts/test-copy-guard.mjs` | 2026-09-16 | Proves the guard fails on known-bad fixtures. A guard never seen failing is not a guard | active |
| `scripts/test-snapshot.mjs` | 2026-09-23 | Round-trips a queue snapshot export, import, and undo; proves four kinds of bad file are refused rather than partially applied; asserts requester identity is absent from the file and named in its omitted list | active |

## Rules and skills

| Path | What it is |
| --- | --- |
| `.cursor/rules/aaa-company-guardrails.mdc` | Company guardrails. Always applies |
| `.cursor/rules/intake-project.mdc` | Project conventions. Always applies |
| `.cursor/rules/uxui-architect.mdc` | UX/UI Architect persona. Manually invoked |
| `.cursor/skills/verify-live-ux/` | Computes real contrast ratios. `scripts/contrast.py` |
| `.cursor/skills/unrestricted-research/` | Broad local and web research |

---

## Expected but missing

Tracked so their absence stays visible instead of being quietly designed around.

| Expected file or answer | Why it matters | Blocked on |
| --- | --- | --- |
| `a3-creative-intake-workfront-mapping.csv` | Cited in the brief example's own footer as the authority for Workfront types and internal names. The nine-question mapping is a **derivation** until this lands | Workfront admin |
| Authoritative ALAN number format | The template and the style guide's real disclaimers disagree. Validation is permissive until resolved | Compliance |
| AAA Life **Language Guide** | Likely constrains brief voice and disclaimer wording. The highest-value of the four missing guides | Marketing |
| AAA Life Product Guide | Product claim accuracy | Marketing |
| AAA Life Direct Mail Guide | Direct mail is a named deliverable type | Marketing |
| AAA National Brand Guide | Parent-brand constraints | Marketing |
| Brand-exact logo SVG and PNG | Current derivative is color-approximate | Brand team |
| CCP supporting procedures: Monitoring, Vendor Management, Incident Reporting | The tactical detail behind the advertising baseline, which is currently general practice rather than CCP-sourced | Compliance |

## Change history

| Date | Change |
| --- | --- |
| 2026-09-16 | Manifest created. Full scan of a consolidated root. Found two AAA Life brief artifacts, three URL bookmarks, and triplicated logo masters that the plan had not accounted for |
| 2026-09-16 | Added `docs/workfront-auth.md`. The Request Queue now assembles a real Workfront payload and refuses to send it, so the reason it refuses needed a document rather than a code comment |
| 2026-09-22 | No new documents. `assets/mocks/add-tools-dialog-interface` is referenced by decision 026 but was supplied in chat rather than saved to the repo, so the dialog's layout source is currently unversioned |
| 2026-09-23 | Added `scripts/test-snapshot.mjs`. Queue snapshots are the first thing this project writes to a file the user then keeps, so the snapshot format and what it deliberately omits are documented in decision 028 rather than only in code. A **snapshot file is not a document and does not belong in `docs/`** — it holds requester PII and is gitignored under `assets/exports/` |
| 2026-10-04 | Step 4 Workfront proxy. `workfront-proxy/` health action + local stand-in; Mission Control reads Connected from `/api/workfront/health`. Decision 029. Dual-write remains Step 6 |
| 2026-10-04 | Reviewer-style Request Queue UI. Local Status/Priority; Executive dashboard tab; Workfront field map in `docs/knowledge/reviewer-queue-fields.md`. Decision 030 |
| 2026-10-06 | Executive dashboard restyle to Concept v1 2×3 cards. Hours/capacity/speed stay placeholders. Decision 034 |
| 2026-10-13 | Executive busy/capacity/speed cards show labeled Concept v1 illustrative figures; queue + jobs stay local. Decision 040 |
| 2026-10-28 | Executive tab merges Figma Executive dashboard 2 (469-7289): Team Portfolio week, card reorder, callouts, Selected/Completed tables with demo rows. Decision 045 |
| 2026-10-29 | Deep Dive SharePoint proxy + SharePointExcelScheduler; live write kill switch default off. Decision 046 |
| 2026-10-29 | Deep Dive Composio preferred Microsoft identity `p92654@aaalife.com` (email only). Decision 047 |
