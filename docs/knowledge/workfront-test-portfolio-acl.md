# Unblock Mission Control New Project create (TEST PORTFOLIO - CHRIS)

**Status:** resolved 2026-11-15 — bare New Project create works via S2S  
**Portfolio ID:** `6aa167f4000304470fb9e879fb8bbd56`  
**Related:** decision 057; `docs/knowledge/workfront-submit-walkthrough.md`

## What create does

Send / Accept posts a **New Project** (no template) with:

| Field | Source |
| --- | --- |
| `name` | Intake project summary (ALAN-prefixed when present) |
| `description` | Audit lines + labeled A3 fields (format kept as plain text) |
| `portfolioID` | `WORKFRONT_PORTFOLIO_ID` (TEST PORTFOLIO - CHRIS) |
| `status` | `CUR` (Current) so the project appears under portfolio **Projects** |

A3 custom-form `parameterValues` are **not** posted. Overview Description is the container.

## Verified after share (2026-11-15)

| Field | Value |
| --- | --- |
| Techacct email | `e94e6b40-1d68-46a4-974d-af46af7cb631@techacct.adobe.com` |
| Workfront User ID | `6abfd42f01507a7bcbe5e395960e3f9f` |
| Access Level | **Standard** |
| Portfolio share | Techacct `accessRules` entry with `coreAction: DELETE` (Manage-class) |
| `GET portfolio/6aa167f4…` | OK |
| `npm run workfront:sample-project` | `"ok": true`, Project `6afa8c9a029f204bb0ac29cb18775864` in TEST PORTFOLIO |

Sample project name: `SAMPLE - Mission Control New Project — delete me` — safe to delete in Workfront.

## Admin steps that fixed it

1. Share **TEST PORTFOLIO - CHRIS** with the S2S techacct user at **Manage** (coreAction DELETE).
2. Keep on `.env.workfront.local` / Vercel (never `VITE_*`):

```bash
WORKFRONT_PORTFOLIO_ID=6aa167f4000304470fb9e879fb8bbd56
WORKFRONT_LIVE_SUBMIT=1
```

3. Restart `npm run workfront:proxy` after env changes.

## Verify

```bash
npm run workfront:sample-project
```

Expect `"ok": true`, a `projectId`, and `portfolioID` matching TEST PORTFOLIO.
