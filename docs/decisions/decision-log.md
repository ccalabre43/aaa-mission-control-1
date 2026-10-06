# Decision log

Dated decisions, brand exceptions, and guardrail changes. Append only. A superseded entry is marked
superseded rather than edited, so the reasoning stays auditable.

Status values: **accepted**, **pending** (awaiting an outside answer), **superseded**.

---

## 2026-09-16 - 001 - Consolidate to a single project root

**Status:** accepted

App code, `.git` history, `.cursor` rules and skills, and the UX audits moved from
`/Users/p92654/Desktop/UX:UI_architect-agent` into `/Users/p92654/Desktop/Intake-Agent-Practice`,
which is now the workspace root.

Rationale: docs and design assets lived in one folder while code and Cursor configuration lived in
another, so project rules did not auto-apply to the code they governed. Files were copied and
verified byte-identical before anything was removed, and the tracker was confirmed to build from the
new root. The old folder was left intact to be archived by hand.

## 2026-09-16 - 002 - Standardize folder names and convert RTF to Markdown

**Status:** accepted

`knowledge:`, `assets:`, `api:`, `department:marketing`, `department:communications`, and `scripts:`
are retired. Contents moved into `assets/brand`, `assets/mocks`, `docs/knowledge`, and `docs/briefs`.

Rationale: macOS Finder renders a colon as a slash, so these folders looked normal while being
invisible to directory listings. The brand PDF and all design assets were unreachable by pattern and
only readable by exact path. Three identical copies of each EPS logo existed across three folders,
verified by MD5 before the duplicates were removed.

RTF sources converted to Markdown; originals preserved in `docs/knowledge/source-originals/`. The
`.webloc` bookmarks were opaque binary plists, so their URLs were extracted into
`docs/knowledge/references.md` and the bookmark files retired.

Note: `marketing-dash-markdown.rtf`, which the plan expected to archive, was not present in the
folder. Nothing was lost; the item is simply moot.

## 2026-09-16 - 003 - Retheme to the AAA Life digital palette

**Status:** accepted

The daisyUI theme changed from `aaa-michigan` (`#003087`, `#98150b`, `#222222`, `#f4f4f4`) to
`aaa-life` using the verified digital values. This visibly changes the existing deliverables tracker.

Rationale: none of the previous values are AAA Life digital colors, and the product is an AAA Life
internal tool. This is brand compliance, not a redesign. Full detail and all computed ratios are in
`docs/knowledge/brand-system.md`.

## 2026-09-16 - 004 - Bright green kept as a documented brand exception

**Status:** pending brand-team sign-off

Green appears nowhere in the AAA Life palette but is deliberate across both dashboard mocks and the
flow stepper. Per the user's decision it stays as an internal-tool accent.

**Accessibility is explicitly not part of this exception.** White glyphs on `#16A34A` are 3.30:1,
which clears 1.4.11's 3:1 for non-text but fails 1.4.3 for any text. As a small stepper dot against
the light header it is 2.84:1 and fails outright. So the bright green is permitted **only** as a large
tile fill behind a white glyph, and the stepper uses `#0D5C2E` instead (8.12:1 white-on-green, 7.00:1
on `#EEEEEE`).

Action: brand team to confirm or reject the accent. If rejected, the Strategy tile moves to a palette
color and nothing else changes.

## 2026-09-16 - 005 - Open Sans, self-hosted, replacing three non-brand fonts

**Status:** accepted

Removed Nunito Sans, Oswald, Roboto, and four `@font-face` blocks for Gotham **Condensed** - a
different family from the specified Gotham, referenced from local fonts most machines lack. Open Sans
is the guide's designated web substitute for Gotham, which is licensed and cannot ship in a web app.
The guide forbids pairing the two, so Open Sans is used alone.

Open Sans is self-hosted via the `@fontsource/open-sans` package rather than loaded from Google
Fonts, and the `preconnect` and stylesheet `<link>` were removed from `index.html`. A webfont request
sends the user's IP address and user agent to a third party on every page load, which is a privacy
consideration under guardrail 5 and entirely avoidable.

## 2026-09-16 - 006 - Field borders and the focus-ring offset

**Status:** accepted

Field borders moved from `#cacaca` (1.64:1, failing 1.4.11 badly) to `#767676` (4.54:1). `#767676` is
now a **border** color only, never text: it is 3.91:1 on `#EEEEEE` and 3.75:1 on the pale blue wash,
both failing 1.4.3. Secondary text uses `#5C5C5C`, which passes on white, gray, and the wash.

**Correction to the approved plan.** The plan asserted the brand-blue focus ring clears 3:1 "against
both white and the border." Computed, `#05539F` against a `#767676` border is **1.68:1**. The 2px
`outline-offset` is therefore load-bearing: it separates the ring from the border so the adjacent
color is the page background, where the ring reaches 7.65:1 on white. Removing the offset would
silently break 1.4.11 and 2.4.13.

This is the "computed, never asserted" guardrail working as intended, against our own plan.

## 2026-09-16 - 007 - Logo web derivatives are interim and color-approximate

**Status:** pending a proper export from the brand team

No PostScript converter is installed, so the web PNGs were produced by extracting the 296x164 TIFF
preview embedded in each EPS and padding it to 358x226 to bake in the required clear space.

**The 2-color derivative is color-approximate.** Its colors come from the EPS preview's CMYK-to-RGB
conversion and measure `#00339A`, `#00669A`, `#FF3333`, `#CD0033`, against the brand digital values
`#05539F` and `#E31E2E`. The guide forbids recoloring the mark, and a preview conversion is an
unintended recolor, so this ships as interim only. The **white derivative is exact** - pure `#FFFFFF`
across all 12,013 opaque pixels.

No SVG exists. Re-vectorizing the raster would alter the mark, which the guide forbids, so it was not
attempted.

Action: request SVG plus PNG exports from the Illustrator source with the digital palette applied.
Detail in `assets/brand/README.md`.

## 2026-09-16 - 008 - ALAN number: permissive validation, captured only at upload

**Status:** pending confirmation with Compliance

The template is `ALAN-0000-000-00`, but the style guide's own disclaimers carry
`ALAN-29541-624-XX`, `ALAN-28515-N22-XX`, `ALAN-29262-124-XX`, and `ALAN-23882-324-XX` - five digits
in the first segment, sometimes a letter in the second, and `XX` in the last.

Sprint 1 therefore accepts four or five digits in the first segment, letters or digits in the second,
and two characters in the last. **An unusual shape warns, never blocks** (Postel's Law), so no
legitimate number is rejected while the specification is open.

Per the user's decision the ALAN number is captured **only in the document upload area of the Context
step**, and Sprint 1 implements the "none found" branch only - `NoopDetector` always reports no match,
so the "Do you have an ALAN number?" question always runs. Document parsing lands later. Choosing
ask-only means no PDF or OCR library enters the bundle now, so no vendor review is triggered.

Action: confirm the authoritative format with Compliance, then tighten the single validator.

## 2026-09-16 - 009 - Two AAA Life brief artifacts found, not yet acted on

**Status:** accepted as documentation; three proposals open

`Creative_Brief_example.docx` (a completed Annuities creative brief) and
`Strategy_Brief_example.docx` (the blank AAA Life strategy brief template) were in `knowledge:` and
were not in the plan's source inventory.

They **do not change** the A3 schema, the guided questions, the ALAN handling, the matcher, or any
screen. Summarized in `docs/knowledge/aaa-life-brief-artifacts.md` with three proposals awaiting a
decision: adding Club/Geography, Impacted Systems, Mandatories, and Seasonality as default custom
questions; shaping `TemplateAssistant` prose on the annuities brief's structure; and a brief-type
selector in a later sprint.

## 2026-09-16 - 010 - Hosting: host-agnostic static build, data stays per-device

**Status:** accepted

Per the user's decision, the build stays portable rather than targeting one host, and per-device
`localStorage` remains the store, with Workfront becoming the shared system of record later rather
than a custom backend.

Consequences carried into the code: the base path comes from `APP_BASE_PATH` and reaches the router
via `import.meta.env.BASE_URL`; SPA history-fallback configs are maintained for Vercel, Netlify,
Azure Static Web Apps, and IIS together; a strict Content-Security-Policy is achievable only because
the app makes no third-party request, and `style-src` still needs `'unsafe-inline'` because React sets
inline style attributes; `robots.txt` and a noindex meta keep an internal tool out of search indexes;
`server.fs.strict: false` is removed from the Vite config since it disabled dev-server filesystem
protection; and `.env*` is ignored so a future secret cannot be committed.

Note on risk: while the app has no backend, a public URL leaks nothing, because there is no
server-side data. Authentication becomes **mandatory** the moment a Workfront proxy exists, since at
that point the deployment holds credentials.

## 2026-09-16 - 011 - Guardrail added: a negative result is also a recommendation

**Status:** accepted. Extends guardrail 7; nothing superseded.

Because the Sprint 1 corpus is only what one browser has stored, a bare "no duplicates found" would
read as an organization-wide statement of fact while actually meaning "nothing matched among the
handful of requests saved in this browser." A requester could reasonably conclude no one else is doing
the work, and be wrong.

Guardrail 7 previously covered only positive matches. It now requires that an absence of results
state the corpus it was drawn from and how complete that corpus was, and that a negative never be
presented as organization-wide unless the corpus actually was.

Implementation: the matcher returns a coverage descriptor alongside its matches, so no code path can
emit a bare negative. The descriptor is **persisted onto the brief at submit time**, because a brief
checked against one browser must not be indistinguishable from one checked against all of Workfront
when a Sprint 2 reviewer reads it. Per the user's decision the disclosure is always visible as quiet
secondary text, not only on the empty state - it stops being a caveat and becomes an accurate
statement once Workfront is connected.

Also specified: if a remote corpus is unreachable, coverage must degrade explicitly rather than
falling back to local data while still implying full coverage.

## 2026-09-16 - 012 - SheetJS repointed to the vendor CDN

**Status:** accepted, pending Vendor Management acknowledgement

The npm `xlsx` package carries two unfixed high-severity advisories: CVE-2023-30533 prototype
pollution (fixed in 0.19.3) and CVE-2024-22363 ReDoS (fixed in 0.20.2). npm's copy stops at 0.18.5
because SheetJS no longer publishes there, so npm reports "no fix available."

This project is **genuinely affected, not merely flagged**: `parseSpreadsheet` in `src/lib/excel.ts`
feeds user-uploaded files into `XLSX.read`, which is exactly the untrusted-parse path both advisories
describe. Export-only workflows would have been unaffected.

Per the user's decision, the dependency is repointed to a pinned SheetJS tarball at version 0.20.2 or
later from `cdn.sheetjs.com`, which clears both advisories with no code change. Installing from
outside the public npm registry is a Vendor Management consideration under guardrail 8.

The library is also lazy-loaded so it leaves the initial bundle, which was 644KB largely because of
it. That is a performance change, not a security one.

**Warning for whoever revisits this:** do not "fix" it with the `xlsx-enhanced` package on npm, which
has been analyzed as containing malware.

## 2026-09-16 - 013 - Host-agnostic static deployment

**Status:** accepted

Per the user's `agnostic` choice, the app ships deployable to any static host with no code change.

`APP_BASE_PATH` is the single value that declares where the app lives. `vite.config.ts` normalizes it
and hands the same value to the router through `import.meta.env.BASE_URL`, so assets and routes cannot
disagree about the prefix - the failure mode where every asset resolves and every deep link 404s.

Client-side routes are not files, so each host needs a history fallback. Configs are maintained
together for Netlify (`public/_redirects`, `public/_headers`), Vercel (`vercel.json`), Azure Static Web
Apps (`public/staticwebapp.config.json`), IIS (`public/web.config`), and Apache (`public/.htaccess`).
Per the project rule these are updated as a set or not at all. Each is inert on hosts that do not read
it, at the cost of the unused ones being publicly fetchable, which reveals hosting intent and nothing
confidential. IIS and Apache are additionally configured to refuse the others.

Also in this pass: `server.fs.strict: false` removed from the Vite config, since it let the dev server
read outside the project root for no benefit; Node pinned via `.nvmrc` and `engines`; `.env` and
`.env.*` gitignored with `.env.example` as the single exception; `robots.txt` and a `noindex` meta,
both documented as requests rather than controls, because the real boundary is network placement.

The package name changed from `aaa-michigan-project-tracker` to `aaa-life-mission-control`. Related
copy correction under guardrail 10: spreadsheet exports were named `AAA-Michigan-*` and are now
`AAA-Life-*`. AAA Michigan is a different organization. This changes a filename the user receives, so
it is recorded rather than applied silently.

## 2026-09-16 - 014 - Content-Security-Policy verified against the running app

**Status:** accepted

The policy is `default-src 'self'` with `script-src`, `style-src`, `font-src`, and `connect-src` all
`'self'`, `img-src 'self' data:`, and `object-src`/`frame-ancestors` `'none'`. Sent by each host config
and by `vite preview`, so it is exercised locally rather than discovered after a deploy. Not sent by
the dev server, whose HMR needs inline scripts; enforcing it there would only train people to ignore
it.

Notably it needs **no `unsafe-inline` for styles**, which looks wrong at first glance because
`RowActionsMenu` positions itself with a React `style` prop. React applies that through CSSOM rather
than by writing a `style` attribute, and CSP does not intercept CSSOM. Verified, not assumed.

`scripts/probe-csp.mjs` walks the app under the policy and found one genuine break that review had
missed: Vite base64-inlines assets under 4 kB, several Open Sans subsets qualify, and `font-src 'self'`
then refused every one of them, silently falling back to a system font for those glyph ranges. Fixed
by never inlining fonts rather than by adding `data:` to `font-src` - the stricter policy holds and the
fonts gain the immutable cache headers.

Favicon: `/favicon.ico` was 404ing on every page load. It now points at the complete 2-color logo,
proportionally scaled. A real square app icon is **not** derived here, because cropping the oval out
or rebuilding a mark from parts is precisely what guardrail 4 forbids. A proper icon needs the brand
team.

## 2026-09-16 - 015 - Live Workfront query for the organization-wide duplicate check

**Status:** accepted, not yet implemented

Per the user's decision, when Workfront access exists the organization-wide corpus will be a **live
query at search time** rather than a cached nightly snapshot. Results are always current, which is what
makes a coverage claim of "across the full Workfront queue" true at the moment it is shown.

The consequence that matters is failure, not the happy path. A live query can time out or be refused,
and the tempting behavior - fall back to the local corpus and keep the wording - is worse than
returning nothing, because it asserts coverage the search did not have. `degradedCoverage()` in
`src/lib/related/coverage.ts` already exists for this: it forces `completeness: "partial"` and appends
the reason, and `mergeCoverage()` reports `organization-wide` only when every contributing matcher did.
Both were written for this decision and must not be bypassed.

Open question for implementation: query volume. The matcher currently runs on a debounce as the
requester types, which is fine against local storage and is not fine against a remote API. Expect to
move the remote call to the Related activity checkpoint, or to debounce it far harder than the local
one.

## 2026-09-16 - 016 - Clear-data controls narrowed to what they actually clear

**Status:** accepted

The home footer button read "Clear my data on this device" while `clearIntakeData()` deliberately left
`aaa-project-tracker` untouched, so tracker rows survived a request the user reasonably read as
covering everything. The function's own comment compounded it, claiming tracker data "is cleared from
its own screen" when no such control existed anywhere.

Resolved by making both statements true rather than by widening one function's reach: the home control
is now "Clear my saved requests on this device" and says tracker rows are unaffected, and the
deliverables screen gained `clearTrackerData()` behind its own confirm. Each screen clears only the
data it owns, so neither control can quietly delete the other feature's records.

`clearTrackerData` removes the storage keys rather than saving an empty array, because writing `[]`
would leave the backup copy in `localStorage` - the user would have asked to clear their data and still
have it on the device. Guardrail 5 requires a real way to clear data on a shared machine, and until now
the tracker had none.

Related: `FORBIDDEN_BARE_NEGATIVE` was removed from `coverage.ts`. Its comment claimed a verification
grep used it; none existed, so the ban from entry 011 was documented but unenforced. The banned
phrasings now live in `scripts/verify-flow.mjs`, which fails the build on finding one in the bundle and
also asserts that the rendered coverage line names its corpus. A checker whose needle sits inside the
code it checks only works while the bundler keeps tree-shaking it out, which is not a guarantee worth
depending on.

---

## 2026-09-16 - 017 - Team routing accepts both teams, exceeding the Workfront field's arity

**Status:** accepted, with a pending Workfront configuration request

The guided question "Which team should handle this?" now accepts Corporate Communications, Brand
Creative Services, or **both**. A request can genuinely need internal communications and marketing
creative, and forcing a single answer made the requester guess on the team's behalf.

`A3IntakeCommunicationType` is a radio field on the A3 form, so Workfront accepts exactly one of its
two options. This is therefore a deliberate divergence from the field's arity, not a UI preference.
Three constraints bound it:

1. **No invented option.** A third "Both" choice was rejected: an option value is as much part of the
   Workfront contract as the field name, and Workfront would reject it identically. Only the two real
   options are ever submitted.
2. **The second team survives regardless.** When more than one is selected, `submitToWorkfront` writes
   an audit line naming every team into the Issue description, the same mechanism entry 008 uses for the
   ALAN number. If Workfront keeps only the first value, the description is the authoritative record.
   The line is driven off `isSingleValueField`, so a second option field inherits the behavior.
3. **Multi-select is a registry capability, not a special case.** `QuestionInputType` gained
   `checkbox`, valid only on an option-bearing field, and the admin view can set any such question to
   one answer or several. Validation still refuses a free-text question over a fixed option list,
   which would let a requester type a value Workfront does not offer.

Values are stored as a comma-joined string in the schema's option order rather than click order, so the
same two choices always produce an identical value - the matcher compares this text and a reviewer may
diff two briefs. `parseOptionValues` validates every token against the real option list, so a
hand-edited `localStorage` entry degrades to the valid options instead of poisoning a payload.

Also fixed as part of this: `ReviewStep` rendered option fields as a single `<select>` in two places.
A two-value answer matched no `<option>`, so opening that field for editing showed an empty dropdown and
the next change silently overwrote both teams with one. Both paths now use the shared `ChoiceGroup`, and
`scripts/verify-flow.mjs` selects every option and asserts both survive to the review step, because that
failure produces a perfectly submittable brief naming the wrong team.

Deferred by explicit decision: the `customForm` value still carries both options, and the live adapter
does not yet fail closed on the arity mismatch. That is acceptable only while `submitToWorkfront` makes
no network call. **Before live submission, the proxy must either send a Workfront-valid single value or
refuse the submission** - it must not silently truncate.

`DEFAULT_REGISTRY_VERSION` moved to 2, so a draft started against the single-answer set is
distinguishable from one started after this change.

## 2026-09-16 - 018 - "Deliverables" reads "Request Queue" on screen, and nothing else changed

The tracker screen is now titled **Request Queue** in the header, the browser tab, the `h1`, the home
footer link, and the confirmation screen's link. This is the rename half of a two-part change: the
queue itself - listing saved requests from `aaa-intake-briefs` with a submit action for drafts - is
approved and deferred, and is specified in `.cursor/plans/request-queue.md`.

Four things deliberately kept their old names, because each one is a contract with something outside
the screen:

1. **`aaa-project-tracker`.** Real user data with no server copy. Renaming a `localStorage` key
   without a migration deletes every row the user has.
2. **`Project/Deliverables`, the first column header.** It is `EXPORT_HEADERS[0]` in `src/lib/types.ts`,
   so it is the literal heading in every spreadsheet already exported, and `HEADER_ALIASES` in
   `src/lib/excel.ts` maps it back on import. Renaming it breaks round-tripping with files users hold.
   It is also the `aria-label` queried in `DeliverablesView.tsx` to focus a newly added row, so a
   rename there would silently break that focus unless the selector moved with it.
3. **`A3IntakeDeliverables`, its label, and the A3 section "Deliverables and outcomes."** Workfront
   contract. The app never renames a Workfront field or label.
4. **The route `/deliverables` and the file `DeliverablesView.tsx`.** Only the reading was asked for.
   Renaming the route means a redirect from the old path plus edits to both probe scripts,
   `docs/deployment.md`, `README.md`, and the comment in `public/_redirects`. Tracked as a follow-up.

The easy string to miss is in `src/lib/related/coverage.ts`: "Rows in the deliverables tracker" appears
inside the duplicate-check coverage disclosure, which exists to name the corpus it actually searched.
Leaving it stale would have made a compliance-relevant disclosure name a screen that no longer exists.

Two strings the plan did not list were caught by screenshotting the result rather than by grepping for
"tracker": the empty state in `TrackerTable.tsx` and `TrackerCards.tsx` read "No deliverables yet",
which is the first line a user sees under a heading now titled Request Queue. Both now read "No rows
yet". Row-scoped copy elsewhere - "Untitled deliverable", "Delete deliverable?", and the table's
`aria-label` - deliberately still says deliverable, because it names the row's `Project/Deliverables`
field rather than the screen.

## 2026-09-16 - 019 - Routing moved from a custom field to a queue topic model

Team routing is now expressed the way Workfront actually expresses it. Workfront does not route a
request with a custom-form value; it routes with a **queue topic** carrying a **routing rule**, and the
topic's position under its queue and topic groups is the `Path` column in the Submitted Requests list.

The app had been treating `A3IntakeCommunicationType` — a radio — as the routing mechanism, which is
why decision 017 was so awkward to write. `src/lib/workfront/queueConfig.ts` now models `QueueDef`,
`QueueTopicGroup`, `QueueTopic`, and `RoutingRule` under Workfront's own names and object codes, so the
contract is legible to anyone who has seen the API.

`IntakeBrief` gained `queueTopicId`, set at the Generating step by matching the Communication Type
answers against each topic's `communicationTypes` **as an exact set**. Exact-set matching is not a
detail: a "contains" match would route a two-team request into whichever single-team topic came first
and look completely successful while sending the work to one team.

The topic is **derived, not asked**. The requester already said which team should handle the work; a
tenth question asking them to pick a queue topic would be the same decision restated in Workfront's
vocabulary, and Hick's Law says the added choice costs time it cannot earn back.

Briefs saved before this existed have no `queueTopicId`. `routeFor` derives a route for those at read
time and returns `source: "derived"`, which the queue renders as "(derived)" and the summary panel
explains in a sentence. Showing an inferred route as though it were a recorded one would overstate what
the app knows, and showing an empty Path would look like a bug.

Every `workfrontID` in the model is an empty string. The app does not invent Workfront IDs, so a topic
without one cannot be submitted against.

## 2026-09-16 - 020 - A both-teams request routes to one triage topic, superseding 017's framing

Decision 017 established that a requester may name both teams. It described the consequence as "treat
every option listed here as in scope", written into the payload's audit lines. With queue topics in
place, that wording is now **wrong**, and the audit line has been rewritten.

A Workfront routing rule holds exactly one default assignee and one default team — "You can only have
one default assignee in this field". So a two-team request cannot be one issue routed to two teams.
Two issues were considered and rejected: it duplicates the work, and this app's own duplicate detection
would then flag the pair it had just created.

The default configuration therefore includes a **"Both teams - needs triage"** topic whose routing rule
targets Creative Operations. A two-team answer lands there, with both teams named in the description.
The audit line now says the request was routed to that topic and that the topic's owner is responsible
for splitting or assigning the work — which is true — instead of implying both teams have seen it,
which was never true.

017's substance stands: multi-select is a general registry capability, both values are submitted, and
converting `A3IntakeCommunicationType` to a checkbox group remains an open Workfront configuration
request. Only its account of what happens downstream is superseded.

## 2026-09-16 - 021 - One status vocabulary: Draft and Ready to send

`briefStatusLabel` in `src/lib/intake/types.ts` is now the only place a brief's status becomes a word.
Three screens render it — the Request Queue, the match cards built by `briefToCorpusRecord`, and the
confirmed screen — and they had drifted: the same request read "Submitted" in a match card and would
have read "Ready to send" in the queue on the same afternoon.

"Ready to send" rather than "Submitted", because nothing has been transmitted. Workfront's own
hard-coded status for the other case is literally "Draft", so that word is used as-is.

**This is a documented deviation from the mocks.** `assets/mocks/requestor-ux-flow.jpg` labels the
stepper's fourth stage "Submitted", and `FlowStepper.tsx` now draws "Ready to send". Mocks are layout
references, not copy decks, and a header that contradicts the queue about the same request is worse
than a header that differs from a drawing. The stage `id` stays `submitted` because `stageIndexFor`
keys off `FlowStep`, not off the label.

The persisted `BriefStatus` values are unchanged — still `draft` and `submitted`. Renaming stored
values would need a migration for no gain.

## 2026-09-16 - 022 - The queue looks send-ready and says it has sent nothing

The Request Queue renders Workfront's Submitted Requests columns, assembles a complete and valid
`WorkfrontIssuePayload`, and shows it on request. It transmits nothing. Holding both of those at once
is the point, so the honesty mechanisms are structural rather than a footnote:

- A header slot reads **"Workfront: not connected"** — the same slot that will read "Connected as ..."
  once a credential exists. Grey, not red: nothing is broken.
- Every row reads **"Sent to Workfront: No"**, in words. Never color alone.
- `sendBlockers` names each specific missing thing, ending with the credential, and the summary panel
  lists them under "Why it has not been sent".
- `scripts/lib/copy-guard.mjs` now fails the build on eight affirmative send claims. Only affirmative
  phrasing is banned: "Sent to Workfront: No" is the honest disclosure the guard exists to protect, so
  a naive substring ban on "sent to Workfront" would fail the build for telling the truth.
  `scripts/test-copy-guard.mjs` asserts each banned phrase fails **and** each safe phrase passes.

Two Workfront columns are deliberately absent. `Ref #` because `referenceNumber` is assigned by
Workfront on creation, and a locally generated one would be a fabricated identifier the UI then
presents as fact — someone would eventually quote it to Workfront support. `Entered By` because it is
assigned server-side from an authenticated identity that is not settled. `Converted to` **does** ship,
always empty, because a column Workfront will fill later is honest where a column that can never be
filled is set dressing.

`submitToWorkfront` gained `readyToSend` and `blockers`, deliberately separate from `ok`. `ok` is about
the requester's work being complete; `readyToSend` is about the queue being configured. Conflating them
would mean an unconfigured queue stopped people from saving their own requests, and there is no server
copy to recover them from. The queue's Submit action for drafts runs the same validator the Review step
uses; it adds a second way in rather than moving the first.

Two things caught by screenshotting rather than by reasoning: the summary panel's Sent row read "Sent
to Workfront: No" as its *value* under a label already saying the same thing, which looked like a stray
debug string; and the admin screen listed three identical "No Workfront queue topic ID yet" problems,
telling the reader there was work to do without telling them where. `validateQueueConfig` now names the
topic in the message.

The admin screen's pending-configuration list is **amber, not red, and carries no `role="alert"`**. Red
is reserved for a final submit action and genuine errors. A missing Workfront ID is the expected state
of a queue nobody has connected yet; rendering the normal case in red teaches an administrator to
ignore the color, which is what makes a real error invisible later.

## 2026-09-16 - 023 - Workfront auth: Server-to-Server recommended, superseding the App Builder proxy choice

`docs/workfront-auth.md` records the recommendation. It supersedes the earlier decision to build an
Adobe App Builder proxy as the answer — App Builder is still the natural **runtime**, but the
credential question turned out to be the binding constraint rather than the hosting one.

Every currently available Workfront option is closed to us:

- **Legacy Workfront custom OAuth2** (Setup > System > OAuth2 Applications, limit 10 per instance):
  no new applications after **2026-11-01**, existing ones stop working **2027-02-01**, no extension
  planned. Covers authorization code, PKCE, and JWT server auth.
- **PKCE gets its own paragraph in the doc precisely because it looks like the answer.** It is the one
  flow designed for a backend-less single-page app, which is exactly this app's shape. It is inside the
  retiring family, so it is a dead end. Writing that down is what stops the next person spending a
  sprint rediscovering it.
- **API keys and `/login`**: no longer recommended by Workfront, and per-user, so an administrator's
  key confers administrator access to whatever holds it.

Recommended: **Adobe Developer Console OAuth Server-to-Server**. Two consequences change the
architecture rather than the configuration. A client-credentials secret cannot live in this app at all
— Vite compiles `VITE_` variables into the public bundle and guardrail 8 forbids it — so a server-side
component is mandatory. And Server-to-Server has one identity, so every issue's **Entered By** becomes
the integration account; either a Workfront UI Extension preserves the real requester through its IMS
shared context, or we accept the service identity and the queue UI has to say so. That is not a choice
to make quietly, because it changes what a Workfront record means.

Vendor Management gate per guardrail 8: flagged before adoption, no live call without approval.

## 2026-09-16 - 024 - Red for a destructive delete, logged as a brand exception

**Status:** accepted, pending brand-team sign-off

Requested: a "Delete this question" affordance at the far right of each question's actions row on
`/settings/questions`, matching Move up and Move down in style, in red.

Guardrail 4 reserves red for "a final submit action and genuine errors," and a delete link is
neither. So this is a deviation and gets an entry rather than being absorbed silently. It is logged
now partly because the practice already existed undocumented: `.aaa-btn-text-danger` has been
carrying `--aaa-red-text` on the tracker's row delete and on the old per-question Remove since
before this entry, so the drift predates the request.

Reasoning for accepting it: the guardrail's stated concern is red **buttons** on screens containing
form fields, where red reads as an error state. This is a text link, not a filled button, and it is
the one irreversible action on the screen. Withholding the conventional destructive color would make
delete look like the same weight of action as Move up.

What the exception does **not** cover:

- **`#a3141f` at 7.84:1 on white, computed, not the print red.** Hover darkens to `#8a1019` at
  9.68:1. An accepted brand exception never approves a WCAG failure, per guardrail 9.
- **Disabled state is grey, not faded red.** A dimmed destructive color reads as a weaker warning
  rather than as unavailable, and it would put the only non-actionable red on the screen.
- **Color is not the only signal.** The control says "Delete this question" in words.

Scope: **everything except the five locked questions is deletable.** `canRemove` was widened from
`question.custom && !isLocked(question)` to just `!isLocked(question)`, so the four built-ins whose
A3 fields are optional can now be deleted alongside custom ones. Requiring `custom` made those four
permanent by accident rather than by rule, and `resetRegistry` already brings a default back, so
refusing bought nothing.

The five stay undeletable for a reason with no backstop downstream: `validateRegistry` checks that a
locked question is not *disabled*, and a deleted question is not there to be checked. If the gate
does not hold in `canRemove`, nothing else catches it, and the person who finds out is a requester
who has answered eight questions.

The control is **rendered only where it works**, so every "Delete this question" on the screen is red
and live. An earlier pass rendered it dimmed on the locked cards as well, reasoning that an absent
affordance reads as a bug. That was wrong in practice: it put grey delete links on most of the screen
and gave five cards a control that did nothing when clicked, which is a worse answer to "can I delete
this?" than no control at all. The locked cards carry the reason in the same row instead - "Always
asked - required by Workfront" - which explains the absence of both the delete control and the
toggle.

Deletion takes **two steps**. The trigger is replaced in place by "Delete this? Yes, delete /
Cancel" rather than opening a dialog, so the row does not reflow and the decision stays beside the
question it applies to. Escape and Cancel both back out. Focus moves to "Yes, delete" on arming,
because replacing the control an admin just activated would otherwise drop focus to `body`. One row
arms at a time.

This supersedes the one-click behavior of the Remove button it replaces, which had no confirm and no
undo. Prominence was the deciding factor: a red control at a predictable position on every card gets
clicked far more often than a link that only appeared on custom questions.

**The bottom-of-screen "Delete a question" picker was removed.** It briefly existed as a dropdown
beside "Add a question". Deleting is now reached only from the question itself. The picker duplicated
the per-row control and made an admin re-identify by label the thing they were already looking at,
and its own list could only ever offer what the rows already showed.

**One vocabulary: this screen says delete, never remove.** The locked-question notice and every
status message were aligned. Two words for one destructive action invites a reader to look for a
difference that is not there. `canRemove` keeps its name - it is the registry's API, not this
screen's copy. A rendered-text assertion, not a source grep, is what caught the last holdout: the
notice still read "but not remove it," which a search for the button labels would have missed.

**Copy correction, surfaced rather than applied silently, per guardrail 10.** The notice claimed "Six
questions are locked." Five are. Six A3 fields are required, but `A3IntakeRequestedBy` is collected
at the Start step and never appears as a guided question, so the screen shows five locked cards. The
number was measured against the rendered DOM, not counted by reading the defaults. It now says five
and explains where the sixth field comes from.

## 2026-09-17 - 025 - Sales Tools tile recolored to #ECB350, which cost it its white glyph

**Status:** accepted, pending brand-team sign-off

Requested: the Sales Tools tile background becomes `#ECB350`. Applied exactly, with two changes the
color forced.

`#ECB350` is a light gold, and every tile until now was a dark fill behind a white glyph. Computed
against that pattern it fails twice:

| Pairing | Computed | 1.4.11 needs |
| --- | --- | --- |
| White glyph on `#ECB350` | 1.89:1 | 3:1 |
| `#ECB350` fill against the white card | 1.89:1 | 3:1 |

Guardrail 9 is the deciding rule: an approved brand exception never approves a WCAG failure. So the
requested value ships and the two things around it move instead.

- **Glyph goes dark**, `--aaa-bronze-glyph: #3D3116`, at **6.75:1** on the fill. This tile is now the
  only one not taking the shared white glyph from `.aaa-tool-icon`.
- **A darker gold edge**, `--aaa-bronze-edge: #B57D1A`, at **3.55:1** on the card, so the square does
  not dissolve into it. `verify-flow.mjs` measures a border in preference to a fill when one is
  present, so this is also what the automated check now reads.

Chosen over the alternative of darkening the fill to about `#9C6A15`, which would have passed
everything with no other change but would not have been the requested color.

The token was **redefined rather than added alongside**, so `--aaa-bronze` no longer holds the guide's
antique bronze `#5F6240`. The name is now inaccurate - it says bronze and holds a gold. That is
recorded in `docs/knowledge/brand-system.md` rather than fixed, because renaming the token is a
separate change and the old value needs to stay findable. The token has exactly one consumer,
`.aaa-tile-bronze`, which is why redefining it was safe.

Verified in the browser rather than from the stylesheet: fill renders `rgb(236, 179, 80)`, glyph
`rgb(61, 49, 22)` (so the override does beat `.aaa-tool-icon`'s white), edge `rgb(181, 125, 26)`, and
the icon box stays 36x36 because `box-sizing: border-box` absorbs the new border. The glyph is stroked
rather than filled and inherits `currentColor`, so it actually took the new color. Full suite passes
with no 1.4.11 failures.

## 2026-09-22 - 026 - The dashboard grid becomes user data, and reordering gets three routes

**Status:** accepted

Requested: `Add Tools` opens a dialog for adding and removing cards, added cards fill rows of four
beneath the existing ones, and cards are draggable by their upper-right corner.

`HomeView`'s `const TOOLS` moved to `src/lib/dashboard/cards.ts` and the grid now loads from
`localStorage` under `aaa-dashboard-cards`, with a backup key, quota messaging, and a repair-not-reject
parse mirroring `src/lib/intake/storage.ts`. Three additional protections exist because this list
renders the home screen and an empty one has no way back: an unreadable entry is skipped rather than
throwing out the array, an empty or unparseable result falls back to `defaultCards()`, and a missing
manager card is re-added on read.

`clearIntakeData` deliberately does **not** clear it. A card layout is a display preference with no
PII, and someone clearing their saved requests has not asked to have their dashboard rearranged. Same
reasoning as `aaa-intake-queue-config`, and the enumerated exclusion list in `storage.ts` was updated
so it stays accurate.

**Added cards are placeholders, by decision rather than by omission.** They carry no route and render
in the existing dashed `Not built yet` state. The alternative - letting an admin create a tile that
looks clickable and goes nowhere - is the exact outcome `HomeView`'s own comment already called worse
than admitting a tool is not ready. `verify-flow.mjs` asserts an added card is not an anchor and does
carry the note, so this cannot regress into a dead link.

### Dragging is not sufficient on its own

WCAG 2.2 added **2.5.7 Dragging Movements** at AA, and guardrail 9 makes AA the floor. A drag-only
control excludes anyone who can click but cannot hold and drag. So there are three routes to one
reorder:

| Route | Mechanism | Covers |
| --- | --- | --- |
| Pointer drag | The grip is the drag source, the card is the drop target | 2.5.7's default path |
| Keyboard | Arrow keys while the grip has focus | 2.1.1 Keyboard |
| Single pointer, no drag | The grip toggles, revealing Move left and Move right | **2.5.7** |

The grip is the drag source rather than the card, because a card that is a link is natively draggable
and dragging it yields a URL drop instead of a reorder. Up and down arrows work as well as left and
right, since the grid is two-across below 900px and "up" is the honest direction there.

The grip is **always visible**, not revealed on hover: a hover-only affordance cannot be found by
touch, and reordering is undiscoverable if its only cue is invisible. *(Superseded by 027 - the grip
is now revealed on rollover where a pointer can hover, and stays permanently visible on touch.)* Its
accessible name carries the
current position (`Reorder Strategy, position 2 of 3`), since the name alone would not say where the
card is. Every move, and every refused move, is announced through an `aria-live` region.

Armed state is carried by `aria-pressed` and by the Move buttons appearing, never by fill alone. The
drop target takes a 3px blue outline (**7.65:1**, computed) rather than the wash tint alone, because
the wash is **1.21:1** against the white card - measuring it is what ruled it out as a sole signal.

### Focus, which is where three defects were

Reordering moves a card in the DOM and a Move button can disable itself by reaching an end of the row.
Both drop focus to `body`. Three controls had this and all three now move focus deliberately:

- After any stepped move, focus returns to the grip, which is always present and always enabled.
- After `Add card`, focus returns to the card title field - clearing the title disables `Add card`
  itself, and the title is where someone adding a second card wants to be anyway.
- After `Yes, remove` or `Yes, reset`, focus moves to the `Current dashboard` heading, next to what
  changed.

The `Add card` case was found by `verify-flow.mjs` rather than by review: Escape stopped closing the
dialog, because a React `onKeyDown` on the scrim only sees events bubbling from something focused
inside it. The listener moved to the window, matching `RequestSummaryPanel`.

A second defect came out of the screenshot. `commit` normalized card order on save but set state from
the un-normalized array, so a freshly added card appeared *after* `Add Tools` until the next reload
silently corrected it. The assertion added for it checks order with no intervening reload, since a
reload is what hid it.

### Departures from the mock

Per guardrail 10 a mock is a layout reference, not a copy deck:

- The mock's top-right `Add` duplicates the footer's `Add Card`; removed.
- The mock's top-right `Save` is gone - changes commit as made, matching the question admin, so there
  is no unsaved-work trap.
- The draft row's checkbox had nothing to select; removed.
- Sentence case retained over the mock's Title Case.
- `Cancel` is a text button, not the mock's filled gray one, which is not in the design system and
  read as disabled beside the filled blue primary.
- The mock's single dark icon square became named radio groups for icon and color. A row of unlabeled
  swatches has no accessible name, and color is never a label - each swatch is `aria-hidden` beside
  real text.

`Delete` reuses the existing `aaa-btn-text-danger` and keeps decision 024's red and its two-step
confirm. It is deliberately **not disabled** when nothing is checked: that class has no disabled
styling, so a disabled instance would look identical to a live one and read as a dead control. It
answers "Select a card to remove first." instead.

`Add Tools` is excluded from both reordering and deletion and is re-pinned last on every read, not
only on write. A control that can delete itself leaves the admin with no way back, and `withManagerLast`
running on read means a hand-edited storage value still renders correctly.

Every new color was computed with `contrast.py`; nothing here is estimated. Full suite passes with no
1.4.3, 1.4.11, or focus failures, and the new checks cover the four-across and two-across breakpoints,
a keyboard reorder surviving a reload, accessible names on every grip and checkbox, and add and delete
both persisting.

## 2026-09-23 - 027 - The reorder grip is revealed on rollover, superseding 026's always-visible grip

**Status:** accepted

Requested: the drag grip on each dashboard card shows on rollover only. This reverses the
always-visible choice in 026, which is marked superseded above rather than rewritten.

Honoring it required three guards, because hiding a control is only safe if every user retains a way
to surface it. Without them this is not a styling preference, it is a removal of the feature for
whoever cannot trigger the reveal.

| Guard | Mechanism | Why |
| --- | --- | --- |
| Touch keeps the grip | `@media (hover: hover) and (pointer: fine)` wraps the hiding | A touch screen reports `hover: none`. There is no rollover on a phone, so hiding it there would delete reordering outright rather than tidy it |
| Keyboard focus reveals it | `.aaa-tool-cell:has(:focus-visible)` | A keyboard user tabbing to an invisible grip has no idea where focus is (2.4.7 Focus Visible) |
| The drop target stays revealed | `.aaa-tool-cell-over` | A native drag does not keep `:hover` reliably updated; React sets this class on dragenter |

### Leaving the card cancels the armed state

Follow-up request: the grabber should go away on mouse out. It did not, for two separate reasons that
both came down to the same confusion between *focused* and *focused by keyboard*:

- The reveal used `:focus-within`, and Chrome focuses a button when you click it. Clicking the grip
  therefore pinned it visible for as long as focus stayed there, so it never went away. Now
  `:has(:focus-visible)`, which distinguishes keyboard focus from click focus.
- The armed state outlived the reveal. `mouseleave` disarms the card, but the first version skipped
  that whenever focus was still inside the cell - which included the click that armed it. So the grip
  vanished while the card stayed armed with the Move buttons still mounted: **an active state nobody
  could see.** The guard now tests `focused.matches(":focus-visible")`, matching the CSS exactly, so a
  mouse click disarms on the way out and a keyboard user's armed grip survives a passing cursor.

Keeping the JS guard and the CSS selector on the same rule is the point. When they disagreed, the
visible state and the real state diverged, and that is the defect rather than the flicker.

Verified end to end rather than reasoned about: hover reveals (opacity 1, not armed), clicking the
grip arms it (2 Move buttons, `aria-pressed="true"`), leaving hides and disarms (opacity 0, 0 Move
buttons, `aria-pressed="false"`), returning reveals it unarmed. `verify-flow.mjs` now asserts the
mouse-out opacity and that no Move button or pressed grip survives the pointer leaving.

Hidden with **`opacity`, never `display: none` or `visibility: hidden`.** Those two remove the grip
from the tab order, which fails 2.1.1 Keyboard and takes the 2.5.7 Move buttons with it - the
single-pointer alternative would exist in the stylesheet and be unreachable in practice.

**The cost is discoverability, and it is real rather than theoretical.** Nothing on a resting
dashboard now indicates the cards can be rearranged. The mitigation is the sentence under the grid,
reworded to "Point at a card to show its grip", which is now the only standing cue that reordering
exists. It is marked in `HomeView` as load-bearing so it does not get trimmed as filler later. If
reordering turns out to go unused, this decision is the first thing to revisit.

`verify-flow.mjs` measures the grip's computed opacity in four states and asserts idle 0, hover 1,
mouse-out 0, and keyboard focus 1. The keyboard assertion is the one most likely to rot, since the
`:has(:focus-visible)` reveal is easy to drop in a refactor and the loss would be invisible to anyone
testing with a mouse.

That assertion has to **tab with a real keyboard**, not call `.focus()`. `:focus-visible` keys off the
input modality, so a scripted focus following mouse movement does not match it and the check reports a
failure no real user would ever see.

Worth recording that the check first reported the reveal as broken at opacity `0.04`. That was the
120ms fade being sampled mid-flight, not a CSS fault; the check now waits for the transition to settle
before reading. A timing race that reports a false failure is its own defect, because the next person
to see it will distrust the check rather than the code.

## 2026-09-23 - 028 - Local saved versions of the Request Queue, and one port for both servers

**Status:** accepted

Requested: a way to keep Request Queue work intact until Workfront is connected. Two things shipped,
plus one pre-existing bug the work exposed.

### The port was the actual data loss

`localStorage` is scoped to scheme, host, **and port**. The dev server ran on 5173 and preview on
4173, so they were two origins with two unrelated copies of every request, queue topic, and tracker
row. Switching between them looked exactly like losing work, and no backup key helps: the backup lives
in the origin that went away.

Both are now pinned to 5173 with `strictPort: true`. The strict flag is the load-bearing half - without
it Vite quietly moves to the next free port when one is busy, silently recreating the split. Failing to
start is better than a second store nobody knows about.

### Snapshots, not another storage key

Every existing safety net here - a backup key beside each primary key, the repair-not-reject parse -
protects against a bad *value*. None protects against losing the *origin*, and "clear site data" takes
a primary key and its backup together. A file outside the browser is the only version that survives
that.

`Export a snapshot` writes one timestamped JSON file covering six keys: requests, queue config,
question registry, recent ALAN numbers, tracker rows, and the tracker sort. The file states what it
captured *and what it omitted*, so a reader who finds no requester identity can tell that was deliberate
rather than broken.

The file is a JSON object with four top-level members. `format` and `schemaVersion` are the header an
importer checks before trusting anything else; a file missing either is refused as not-a-snapshot rather
than guessed at.

| Member | What it holds |
| --- | --- |
| `format` | `aaa-mission-control-queue-snapshot`, so a JSON file from anywhere else is refused |
| `schemaVersion` | `1`. A **higher** number is refused by an older reader |
| `data` | The six captured keys, each as its raw stored string |
| `meta` | When and where it was exported, a per-key count, and `omitted` — the keys left out and why |

Captured: `aaa-intake-briefs`, `aaa-intake-queue-config`, `aaa-intake-question-registry`,
`aaa-intake-recent-alan`, `aaa-project-tracker`, `aaa-project-tracker-order-mode`. Omitted:
`aaa-intake-identity` (PII, see below), `aaa-dashboard-cards` (a display preference, not queue data),
and `aaa-intake-briefs-backup` (derived from the primary key, so restoring it would preserve a stale
copy). The captured list is enumerated rather than "every `aaa-` key" — a wildcard would have swept the
excluded identity key back in the moment someone added it.

**Replace, never merge.** Merging by id sounds friendlier and is a trap: two snapshots from two origins
carry records under independently generated ids, so a merge produces a queue that never existed
anywhere, with no way to tell which half came from where. Replace is at least a state that was real,
and a single-depth rollback makes it reversible.

**Import fails closed**, which is the opposite of how a single record is read. Repair-not-reject is
right for one brief because the alternative is losing it; refuse-don't-guess is right for a snapshot
because it is applied *over* live data, and a half-understood file is the one case where doing nothing
is clearly better. A snapshot from a newer `schemaVersion` is refused outright rather than partially
applied - an older reader silently dropping fields it has no concept of would look like a successful
restore. An unrecognized *key* only warns, because refusing a whole file over one stray key would make
a snapshot from a slightly different build unusable.

`SNAPSHOT_SCHEMA_VERSION` exists for that refusal, not for migration. Nothing else in the app carries a
version stamp, which is a gap worth closing as the brief shape keeps changing.

### PII, which cannot be designed out of this

A faithful snapshot carries requester name, email, and department - they live in each brief's
`identity` and again in its assembled `A3IntakeRequestedBy`, so stripping them would break the fidelity
the snapshot exists to provide. Three consequences:

- **`aaa-intake-identity` is excluded.** It is the requester's own saved details, kept only to avoid
  retyping, and reproducing the queue does not need it. Real minimization rather than a gesture, and
  `test-snapshot.mjs` asserts its absence from the file rather than trusting the intent.
- **`aaa-dashboard-cards` is excluded** as a display preference, not queue data.
- The screen says the file holds PII, says not to commit one, and calls sharing one a privacy decision.
  `assets/exports/*` was already gitignored for this reason; a browser download lands in `~/Downloads`
  where nothing protects it.

### Sample requests, and why they need no confirmation

Five fixtures cover the states the queue renders differently: a draft, a both-teams triage, a
review-severity compliance flag, and one with `queueTopicId: null` so the derived-route path runs
against something. Reaching that spread by hand means walking seven steps repeatedly, which is how
people end up testing only the path they just typed.

Safe in the shipped bundle rather than behind a dev flag because of three properties: every requester
is fictional with an `example.invalid` address that can never resolve, every title is prefixed `SAMPLE`
so it cannot be mistaken for real work at a glance, and ids are fixed under `sample-` so loading is an
idempotent upsert and removal deletes exactly those ids. It cannot damage real work, which is why
asking would be friction that teaches people to click through confirmations. Import, which *can*
destroy work, does get a confirm and an undo.

The prefix had to go on `A3IntakeProjectSummary`, not `workfront.issueName`: the queue's Name column
comes from `buildWorkfrontPayload(...).name` falling back to `briefTitle`, so prefixing the issue name
alone would have left the claim false on the screen where it matters.

### A pre-existing bug this surfaced

`verify-flow.mjs` began failing with "First tab stop is SELECT:aaa-input, expected the skip link" on
`/request` - a screen untouched by this work. The cause was a "skip the first render" boolean ref
guarding the step-heading focus. StrictMode re-runs an effect on the *same* component instance, so the
ref was already spent on the second pass and the heading took focus on load, putting the skip link and
header behind the user where forward Tab could never reach them. The guard's own comment described
exactly this symptom, which it had been written to prevent.

It now compares against the last focused step instead of a first-render flag, so a repeated invocation
carries the same step and does nothing. Focusing on a real step change still works.

Worth recording that this check had been **passing by luck**, not working: whether the effect landed
before the harness measured was a race, and this work shifted the timing enough to expose it. A guard
keyed on "is this the first run" is fragile in a way one keyed on "did the thing actually change" is
not.

### Deliberately not built

- **No merge.** See above.
- **No multi-step undo history.** A stack of whole-queue states in `localStorage` is a quota problem.
  One step back covers the mistake this exists for.
- **No automatic snapshots.** Writing a file without being asked is a surprise, and the File System
  Access API route would mean holding a persistent handle to a real folder - a larger privacy surface
  than this stopgap justifies.

This should be **retired rather than extended** once Workfront is connected. A snapshot is one device's
file, not a shared record: two people with two files have two unrelated truths, which is the problem a
real queue exists to solve.

## 2026-10-04 - 029 - Workfront proxy health (Step 4), secrets stay off the Vite bundle

**Status:** accepted

Probe 3 proved read access to `mission-control-v1` and the three queue topic IDs. Step 4 adds the
server-side component decision 023 required: an Adobe App Builder Runtime health action under
`workfront-proxy/`, with a local stand-in for machines that are not yet deploying with `aio`.

Mission Control calls same-origin `/api/workfront/health` in development (Vite proxies to
`127.0.0.1:8787`) or a public `WORKFRONT_PROXY_URL` at build time. That URL is not a secret; 
`WORKFRONT_CLIENT_SECRET` never enters a `VITE_` variable or the client bundle. The health body is
`{ connected, project: { ID, name } }` only.

Default queue config now carries the Production project and topic IDs confirmed in Probe 3. Routing
rule Workfront IDs remain blank. Live submit stays blocked (`mode: "local"`) until dual-write (Step
6). The Request Queue header and Manage Queue notice follow proxy health rather than a hard-coded
"not connected" string.

Local Node `fetch` on this corp laptop failed TLS (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`) while system
`curl` succeeded; the health helper falls back to curl only for that issuer error so local verify
matches Production without disabling TLS verification globally.

## 2026-10-04 - 030 - Reviewer-style Request Queue UI; local Status/Priority; Workfront path kept

**Status:** accepted

The Request Queue list is restyled to the reviewer mock (`assets/mocks/request-queue-reviewer-interface.png`)
while remaining a request list aimed at Workfront `mission-control-v1`.

Local `brief.reviewer` holds Status, Priority, and `firstReviewedAt` (NEW badge). Those values are
editable in the app queue and summary panel. They are **not** added to `a3Schema.ts` and are **not**
posted by `buildWorkfrontPayload`. Preferred later targets are native Issue `status` / `priority`
(see `docs/knowledge/reviewer-queue-fields.md`); a custom A3 dropdown is a config request only if
native statuses cannot match.

Page tabs: Request queue | Executive dashboard. Executive summaries are computed from this browser’s
briefs and tracker rows, with an explicit coverage line. Hours/capacity slots stay stubbed until a
Workfront assignment API is approved. The Project tracker moves under the Executive tab so it is not
deleted.

## 2026-10-04 - 031 - Full-page request summary; keep Workfront payload tab

**Status:** accepted

Selecting Summary on the Request Queue opens `/deliverables/requests/:briefId` (comp:
`assets/mocks/request-summary-page.png`) instead of the slide-over dialog. The page keeps
**Summary** and **Workfront payload** tabs. Comp field labels map to existing A3 values where
possible; empty cells show an em dash. Local `brief.reviewer` gains Impact / Effort / Risk
assessment levels (not posted). Footer actions update local status/priority or run
`submitToWorkfront` in local mode with honest “not sent” messaging.

## 2026-10-05 - 032 - Deep Dive white glyph: darken bronze fill, superseding 025's dark glyph

**Status:** accepted, pending brand-team sign-off

Request: white magnifying glass on the Deep Dive (former Sales Tools) tile. White on the shipped
`#ECB350` fill is **1.89:1** and fails WCAG 1.4.11. Guardrail 9 forbids shipping that pairing.

Applied the alternative recorded in decision 025: darken `--aaa-bronze` to **`#9C6A15`**. Verified
with `contrast.py`:

| Pairing | Computed | Floor |
| --- | --- | --- |
| White glyph on `#9C6A15` | **4.68:1** | 3:1 (1.4.11) |
| `#9C6A15` fill on white card | **4.68:1** | 3:1 (1.4.11) |

`.aaa-tile-bronze` again inherits white from `.aaa-tool-icon`. The dark glyph and gold edge tokens
remain in the stylesheet for provenance but are unused. Decision 025's choice of light fill + dark
glyph is superseded for this tile; `#ECB350` stays documented as the rejected light value.

## 2026-10-05 - 033 - Deep Dive tile brighter orange `#EA580C`

**Status:** accepted, pending brand-team sign-off

Request: brighter, more orange fill on the Deep Dive card than the muted gold `#9C6A15` from 032.
Chosen **`#EA580C`**. Verified with `contrast.py`:

| Pairing | Computed | Floor |
| --- | --- | --- |
| White glyph on `#EA580C` | **3.56:1** | 3:1 (1.4.11) |
| `#EA580C` fill on white card | **3.56:1** | 3:1 (1.4.11) |

Lighter candidates such as `#F97316` fail at **2.80:1** and were rejected. White glyph stays. Add Tools
picker label for this tint is **Orange**. Token id remains `aaa-tile-bronze` / `--aaa-bronze` until a
rename is decided with brand.

## 2026-10-06 - 034 - Executive dashboard Concept v1 layout; hours still placeholders

**Status:** accepted

The Executive dashboard tab is restyled to the 2×3 card layout from A3 Creative Intake Concept v1
(Figma proto node `312:3061`, mock `assets/mocks/executive-dashboard-concept-v1.png`). Request Queue,
Workfront proxy, storage keys, and the Project tracker block under the tab are unchanged.

Queue counts, tracker job bars, and escalations use this browser’s saved briefs and
`aaa-project-tracker` rows. Hours booked, open hours, week capacity bars, average days-to-decision,
and on-time % stay em dashes with a “placeholder / not connected” chip — the prototype’s 80% / 2.1
days are not shown as live facts (guardrail 7). Reviewer status labels stay the shipped set (Needs
review, Needs clarification, Escalated, Approved — transfer, Closed, Deferred to backlog), not the
Figma “Accepted / Awaiting review” wording.

Chip contrast vs fill, verified with `contrast.py`: muted 8.66:1, ok 6.54:1, info 7.85:1, alert 8.94:1,
due-soon 7.28:1.

## Open items awaiting outside input

| Item | Blocked on | Entry |
| --- | --- | --- |
| Authoritative ALAN number format | Compliance | 008 |
| `a3-creative-intake-workfront-mapping.csv` | Workfront admin | - |
| Bright green accent approval | Brand team | 004 |
| Brand-exact logo SVG and PNG exports | Brand team | 007 |
| AAA Life Language Guide, Product, Direct Mail, National Brand guides | Marketing | - |
| Workfront custom fields for ALAN number and match coverage | Workfront admin | 008, 011 |
| Vendor Management acknowledgement for the SheetJS CDN install | Vendor Management | 012 |
| Square app icon and favicon that do not disassemble the logo | Brand team | 014 |
| Workfront API access, credentials, and rate limits for the live match query | Workfront admin, Vendor Management | 015 |
| Convert `A3IntakeCommunicationType` from radio to a checkbox group | Workfront admin | 017 |
| The real queue's Workfront project ID, plus a queue topic ID, topic group ID, and routing rule ID for each topic. Nothing transmits without these | Workfront admin | 019, 022 |
| Confirmation that the proposed topic structure matches the real A3 Creative Intake queue. Every default in `queueConfig.ts` is a proposal | Workfront admin | 019 |
| A triage team for the both-teams topic. `Creative Operations` is a placeholder | Marketing, Creative Operations | 020 |
| Whether Entered By may be the integration account, or the tool must move inside Workfront as a UI Extension to preserve the requester | Workfront admin, Marketing | 023 |
| Adobe Runtime deploy of `workfront-proxy` on the S2S Console project, with `WORKFRONT_CLIENT_SECRET` as a Runtime secret (local health verified; production Runtime URL still needed) | Workfront admin, App Builder owner | 023, 029 |
| Vendor Management acknowledgement for the live Workfront S2S + Runtime path | Vendor Management | 023, 029 |
| Confirm request-queue native Issue status group vs custom `A3IntakeReviewStatus`; confirm P1–P3 → priority enum | Workfront admin | 030 |
| Workfront hours / Resource Planner for Executive dashboard (typed adapter first) | Workfront admin, Vendor Management | 030 |
| How attachments reach Workfront. Documents need a separate upload call and this app never persists file contents | Workfront admin | 023 |
| Sign-off on red for a destructive delete link, and on the tracker's existing row delete that already used it | Brand team | 024 |
| Sign-off on Deep Dive tile `#EA580C` (and prior steps from `#ECB350` / `#9C6A15`), and on whether `--aaa-bronze` should be renamed | Brand team | 025, 032, 033 |
| Whether a user-added card should ever get a real destination, and who decides it. Added cards are placeholders today, and pointing one anywhere is a scope decision rather than a setting | Marketing | 026 |
| Whether a dashboard layout should be shared across a team rather than per-browser. It is a per-device display preference today, so two people on one machine share one layout and one person on two machines has two | Marketing | 026 |
| Whether anyone actually finds card reordering now that the grip only appears on rollover. Worth watching, since a hint sentence is the only standing cue | Marketing | 027 |
| Whether snapshot files may be emailed or shared at all, given they carry requester names and emails. Treated as no until reviewed | Compliance, Privacy | 028 |
| A schema version stamp on the stored records themselves, not just on the snapshot envelope. Currently no brief, queue config, or registry says which shape it is | - | 028 |

## Flagged for the user, not applied

- `.cursor/rules/uxui-architect.mdc` describes the persona as serving "AAA Life of Michigan." The
  brand guide and CCP name the company **AAA Life Insurance Company**, headquartered in Livonia, MI.
  This changes meaning rather than spelling, so per guardrail 10 it is surfaced here instead of being
  edited.
