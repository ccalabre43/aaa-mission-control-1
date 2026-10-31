# Workfront proxy (health + Tasks + documents)

Adobe App Builder Runtime actions that hold the Workfront OAuth Server-to-Server secret and expose
health, Task create/list, and document upload for Mission Control. The Vite app never sees
`client_secret`.

## Runtime setup (Developer Console)

1. On the **same** Adobe Developer Console project that has the Workfront S2S credential, enable
   **Runtime** / App Builder if it is not already on.
2. Set Runtime secrets (or `.env` used by `aio app deploy`) — never paste values into chat:

   - `WORKFRONT_CLIENT_ID`
   - `WORKFRONT_CLIENT_SECRET`
   - `WORKFRONT_HOST` = `https://aaalife.my.workfront.com`
   - `WORKFRONT_PROJECT_ID` = `6abae2b600041e3ecb6a8da4dbe7b4a1`
   - `WORKFRONT_LIVE_SUBMIT` = `1` only when dual-write create is approved (kill switch)

   **Rotate `WORKFRONT_CLIENT_SECRET` on first production publish** (and whenever a value has been pasted in chat): add a new secret in Developer Console, put only the new value in `.env.workfront.local` and in Runtime secrets, delete the old secret, then `npm run workfront:health`. Never paste secrets into chat. Never `VITE_*`.

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
# expect connected + liveSubmit from WORKFRONT_LIVE_SUBMIT
curl -sS http://127.0.0.1:8787/issues
# list summary Tasks on mission-control-v1 (path name /issues; object type TASK)
```

One-shot without a long-running server:

```bash
npm run workfront:health
npm run workfront:sample-create
```

Local routes: `GET /health`, `GET /issues` (lists Tasks), `POST /issues` (creates a Task),
`POST /documents` (uploads to Task Documents + project Documents → Tasks folder),
`POST /priority` (Task urgency), `GET`/`POST /portfolio` (Portfolio Optimization order);
live writes require kill switch + `confirmLive: true`.

If sample-create fails with *insufficient access to add this Task*, raise the S2S tech account
Access Level — see `docs/knowledge/workfront-add-tasks-acl.md`.

If the request includes `Authorization: Bearer <IMS user token>`, that token is used for
Workfront instead of S2S `client_credentials`. Responses include `auth: "bearer"` (or
`client_credentials` / `access_token`). Never put the token in `VITE_*` or commit it.

## Step 4 — run as Chris (local verify before ExC host)

Full Path A hosts Mission Control inside Experience Cloud Shell. Until that host is wired,
verify the Bearer path locally:

1. From the **repo root**, with Vite + `npm run workfront:proxy` already running:

   ```bash
   npm run aio:login
   ```

   Sign in as **CCalabrese@aaalife.com** in the browser. The CLI prints an access token once —
   **do not paste it into chat**.

2. In Mission Control (`http://127.0.0.1:5173`), open DevTools → Console and run
   (replace `PASTE` with the token; session only; clears when the tab closes):

   ```js
   sessionStorage.setItem("__mc_dev_ims__", "PASTE");
   location.reload();
   ```

3. Summary → Submit to Workfront Que: confirm should say **signed-in Adobe identity** (or at
   least not only S2S). Network on create should show `Authorization: Bearer` and the proxy
   response `auth: "bearer"`.

4. Production Path A still needs Mission Control as the ExC Shell `web-src` (`aio app run` /
   deploy against Runtime `4374692-155tomatopeacock`) so the token comes from `@adobe/exc-app`
   instead of step 2.

## Response contract

Success (health):

```json
{
  "connected": true,
  "liveSubmit": false,
  "project": { "ID": "6abae2b600041e3ecb6a8da4dbe7b4a1", "name": "mission-control-v1" },
  "auth": "client_credentials",
  "host": "https://aaalife.my.workfront.com"
}
```

Failure: HTTP 503, `{ "connected": false, "error": "..." }` — never includes tokens or secrets.
