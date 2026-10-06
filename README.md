# Mission Control — AAA Life marketing intake dashboard

An internal AAA Life tool. A conversational creative-request intake that produces an A3 Creative
Intake brief mapped to Adobe Workfront field names, plus the Request Queue's project tracker.

## Running it

```bash
npm install
npm run dev      # Vite dev server, port 5173
npm run build    # tsc --noEmit, then vite build
npm run preview  # serves the build, also port 5173
```

All data is stored in browser `localStorage`. There is no backend and no network call to any
third-party service.

Dev and preview share port 5173 on purpose. `localStorage` is scoped to the port as well as the host,
so running them on different ports gives you two unrelated copies of every request and looks exactly
like losing your work. Both use `strictPort`, so a busy port fails to start rather than quietly moving
and recreating the split.

Since a browser store is the only copy, the Request Queue has a **Saved versions** section that exports
a timestamped JSON snapshot and imports one back. A snapshot carries requester names and emails, so it
is PII: keep it on your own device and never commit one. It also ships five fake sample requests for
developing queue features without walking the flow each time. See decision 028.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Mission Control home — the tool cards, which can be added to, deleted, and reordered |
| `/request` | The creative request flow, seven steps |
| `/deliverables` | The Request Queue — the Workfront-shaped request list, local saved versions, and the project tracker. Renamed on screen; the path is unchanged |
| `/settings/questions` | Manage the guided question set |
| `/settings/queue` | Manage the queue's topics, topic groups, and routing rules |

## Where things live

```
.cursor/rules/        aaa-company-guardrails.mdc (always applies), intake-project.mdc, uxui-architect.mdc
.cursor/skills/       verify-live-ux (contrast script), unrestricted-research
.cursor/plans/        canonical working plans
assets/brand/         style guide PDF, EPS logo masters, web logo derivatives
assets/mocks/         5 UI screens, 2 flow diagrams, the Workfront form example
docs/INDEX.md         manifest of every document — start here
docs/knowledge/       requirements, flows, brand system, A3 schema
docs/briefs/          brief templates and real AAA Life brief artifacts
docs/decisions/       decision log, including logged brand exceptions
docs/audits/          AAA Life UX audits
src/                  app code
```

## Ground rules

Three things are easy to get wrong and expensive to undo:

1. **`aaa-project-tracker` is the tracker's `localStorage` key.** Renaming it without a migration
   loses real user data. See `src/lib/storage.ts`.
2. **The app never invents a Workfront field.** Anything Workfront must accept has to exist in the
   A3 Creative Intake custom form. See `docs/knowledge/a3-schema.md`.
3. **A reorderable or drag-driven control needs a no-drag route.** WCAG 2.2's 2.5.7 Dragging Movements
   is AA, and AA is the floor. The dashboard grid is the worked example: drag, arrow keys, and Move
   buttons all reach the same reorder. See decision 026.

Full conventions are in `.cursor/rules/intake-project.mdc`; company and compliance guardrails are in
`.cursor/rules/aaa-company-guardrails.mdc`. Both load automatically in Cursor.

## Status

Sprint 0 (foundation, brand tokens, guardrails) and Sprint 1 (requester experience) are built. The
reviewer experience is designed and documented, not built. Contrast figures in the docs are computed
with `.cursor/skills/verify-live-ux/scripts/contrast.py`, never estimated.

## Open blockers

- Authoritative ALAN number format — pending Compliance. Validated permissively until confirmed.
- `a3-creative-intake-workfront-mapping.csv` — the cited authority for Workfront field types.
- AAA Life Language Guide, Product Guide, Direct Mail Guide, AAA National Brand Guide.
