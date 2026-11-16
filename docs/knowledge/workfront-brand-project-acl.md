# Unblock Mission Control project-from-template create (S2S ACL)

**Status:** resolved for Send into TEST PORTFOLIO - CHRIS (decision 059 live sample OK 2026-11-16)  
**Related:** decisions 055 / 059; `docs/knowledge/workfront-submit-walkthrough.md`

Send creates from this Template into **TEST PORTFOLIO - CHRIS** (`WORKFRONT_PORTFOLIO_ID`), not
the Brand portfolio. Brand portfolio Manage is only needed if you revive Brand landing.

## Probe findings (admin gate)

| Object | ID | Result |
| --- | --- | --- |
| Pattern URL object | `6ae251e20006bc4078d76f88518f32e8` | **PROJ** named `BIM \| EMAIL CREATIVE DEVELOPMENT TEMPLATE - Project` (not a Setup Template) |
| Real Template (TMPL) | `669e92cd00136878c607c40cf02e356c` | On the PROJ as `templateID`. S2S **cannot view** this Template yet |
| Brand Team portfolio | `63fe29510080e44cc362ace791da828a` | **Portfolio**, not a project. Do not set as `WORKFRONT_PROJECT_ID` / queue `workfrontProjectID` — health would call `project/<id>` and fail. `project/search?portfolioID=` works (health uses this); direct Portfolio view and assign **fail** (insufficient access) |
| Bare `POST project` + `description` | n/a | **Works** — Overview Description can be set on create |
| `POST project` with `templateID` + `portfolioID` | n/a | **Fails** until Template View/Use and Brand portfolio Manage are granted |

Tech account (same as Task ACL): see `docs/knowledge/workfront-add-tasks-acl.md`.

## Admin steps required

1. **Confirm TMPL** — already confirmed: use `669e92cd00136878c607c40cf02e356c`, not the Project URL id.
2. **Share the Template** with the S2S techacct user — at least **View** / ability to create projects from template.
3. **Share Brand Team portfolio** `63fe29510080e44cc362ace791da828a` with Manage (create projects under it).
4. Set on `.env.workfront.local` (never `VITE_*`):

```bash
WORKFRONT_TEMPLATE_ID=669e92cd00136878c607c40cf02e356c
WORKFRONT_BRAND_PORTFOLIO_ID=63fe29510080e44cc362ace791da828a
WORKFRONT_LIVE_SUBMIT=1
```

Keep `WORKFRONT_PORTFOLIO_ID` as TEST PORTFOLIO - CHRIS for Executive Portfolio Optimization — do not overwrite it with the Brand id.

5. Restart `npm run workfront:proxy`.

## Verify

```bash
npm run workfront:sample-project
```

Expect `"ok": true`, a `projectId`, and a `projectUrl`. Open the project → **Overview → Description** should show the probe text; Tasks tab should show template phases when Template create succeeds.

Until ACL is granted, the sample script exits 1 with an access error that points at this doc.
