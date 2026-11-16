# Unblock Mission Control New Project create (TEST PORTFOLIO - CHRIS)

**Status:** decision 057 — bare New Project into TEST PORTFOLIO - CHRIS  
**Portfolio ID:** `6aa167f4000304470fb9e879fb8bbd56`  
**Related:** `docs/knowledge/workfront-submit-walkthrough.md`

## What create does

Send / Accept posts a **New Project** (no template) with:

| Field | Source |
| --- | --- |
| `name` | Intake project summary (ALAN-prefixed when present) |
| `description` | Audit lines + labeled A3 fields (format kept as plain text) |
| `portfolioID` | `WORKFRONT_PORTFOLIO_ID` (TEST PORTFOLIO - CHRIS) |

A3 custom-form `parameterValues` are **not** posted. Overview Description is the container.

## Probe findings

| Check | Result |
| --- | --- |
| `project/search?portfolioID=6aa167f4…` | Works for S2S (list / health) |
| `GET portfolio/6aa167f4…` | Insufficient access (expected) |
| Bare `POST project` + `portfolioID` | Requires **Manage** on this portfolio for the S2S tech account |

Tech account: same as Task ACL — see `docs/knowledge/workfront-add-tasks-acl.md`.

## Admin steps required

1. Share **TEST PORTFOLIO - CHRIS** `6aa167f4000304470fb9e879fb8bbd56` with the S2S techacct user — **Manage** (create projects under it).
2. Keep on `.env.workfront.local` (never `VITE_*`):

```bash
WORKFRONT_PORTFOLIO_ID=6aa167f4000304470fb9e879fb8bbd56
WORKFRONT_LIVE_SUBMIT=1
```

`WORKFRONT_TEMPLATE_ID` and `WORKFRONT_BRAND_PORTFOLIO_ID` are **not** required for this create path (decision 057).

3. Restart `npm run workfront:proxy`.

## Verify

```bash
npm run workfront:sample-project
```

Expect `"ok": true`, a `projectId`, and `portfolioID` matching TEST PORTFOLIO. Open the project → name and Overview Description match the sample payload.

Until Manage is granted, the sample script exits 1 with an access error that points at this doc.
