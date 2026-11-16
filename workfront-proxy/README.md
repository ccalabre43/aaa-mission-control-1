# Workfront proxy (health + New Projects + documents)

Adobe App Builder Runtime actions that hold the Workfront OAuth Server-to-Server secret and expose
health, New Project create/list in TEST PORTFOLIO - CHRIS, and document upload for Mission Control.
The Vite app never sees `client_secret`.

## Local setup

1. Copy `.env.example` values into the repo-root `.env.workfront.local` (gitignored).
2. Required for create:
   - `WORKFRONT_CLIENT_ID` / `WORKFRONT_CLIENT_SECRET`
   - `WORKFRONT_HOST` = `https://aaalife.my.workfront.com`
   - `WORKFRONT_PROJECT_ID` = `6abae2b600041e3ecb6a8da4dbe7b4a1` (health / legacy)
   - `WORKFRONT_PORTFOLIO_ID` = TEST PORTFOLIO - CHRIS id (create + Refresh + Apply order)
   - `WORKFRONT_LIVE_SUBMIT` = `1` only when dual-write create is approved (kill switch)
3. From the repo root: `npm run workfront:proxy`

```bash
curl -sS http://127.0.0.1:8787/health
# projectCreateConfigured + createPortfolio.reachable when WORKFRONT_PORTFOLIO_ID is set

npm run workfront:sample-project
# bare New Project in TEST PORTFOLIO; Overview Description from the sample payload

curl -sS http://127.0.0.1:8787/projects
# list TEST PORTFOLIO projects (summary fields)
```

Local routes: `GET /health`, `GET`/`POST /projects` (New Project create/list), `POST /documents`
(uploads to project Documents → Intake), `GET`/`POST /issues` (legacy Task path),
`POST /priority` (Task urgency), `GET`/`POST /portfolio` (Portfolio Optimization order).

If sample-project fails with *insufficient access*, share Manage on TEST PORTFOLIO - CHRIS with
the S2S tech account — see `docs/knowledge/workfront-test-portfolio-acl.md`.
