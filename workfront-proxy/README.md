# Workfront proxy (Step 4)

Adobe App Builder Runtime action that holds the Workfront OAuth Server-to-Server secret and exposes
a health endpoint for Mission Control. The Vite app never sees `client_secret`.

## Runtime setup (Developer Console)

1. On the **same** Adobe Developer Console project that has the Workfront S2S credential, enable
   **Runtime** / App Builder if it is not already on.
2. Set Runtime secrets (or `.env` used by `aio app deploy`) — never paste values into chat:

   - `WORKFRONT_CLIENT_ID`
   - `WORKFRONT_CLIENT_SECRET`
   - `WORKFRONT_HOST` = `https://aaalife.my.workfront.com`
   - `WORKFRONT_PROJECT_ID` = `6abae2b600041e3ecb6a8da4dbe7b4a1`

3. From this folder, with `@adobe/aio-cli` installed and logged in:

   ```bash
   aio app deploy
   ```

4. Point Mission Control at the deployed web action URL via `WORKFRONT_PROXY_URL` (repo-root build
   env, **not** `VITE_`). Or leave it unset for local dev and use the Vite `/api/workfront` proxy.

## Local verify (no aio required)

```bash
# repo root — gitignored
cp workfront-proxy/.env.example .env.workfront.local
# fill CLIENT_ID + CLIENT_SECRET, or WORKFRONT_ACCESS_TOKEN for a short-lived local check

npm run workfront:proxy
# other terminal:
curl -sS http://127.0.0.1:8787/health
# expect: {"connected":true,"project":{"ID":"...","name":"mission-control-v1"},...}
```

One-shot without a long-running server:

```bash
npm run workfront:health
```

## Response contract

Success:

```json
{
  "connected": true,
  "project": { "ID": "6abae2b600041e3ecb6a8da4dbe7b4a1", "name": "mission-control-v1" },
  "auth": "client_credentials",
  "host": "https://aaalife.my.workfront.com"
}
```

Failure: HTTP 503, `{ "connected": false, "error": "..." }` — never includes tokens or secrets.
