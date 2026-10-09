# Unblock Mission Control Task create (S2S Access Level + project share)

**Status:** resolved 2026-10-09 — Task create works via S2S  
**Related:** decisions 036–039; `docs/knowledge/workfront-submit-walkthrough.md`

## What was wrong

Health and Task **list** worked. Task **create** failed until both of these were true:

1. Tech account Access Level allowed Task create (not built-in **Contributor** alone).
2. Project **Share** on **mission-control-v1** included **ADD_TASKS** (Access Level alone was not enough).

| Field | Value (verified after fix) |
| --- | --- |
| Email / name | `e94e6b40-1d68-46a4-974d-af46af7cb631@techacct.adobe.com` |
| Workfront User ID | `6abfd42f01507a7bcbe5e395960e3f9f` |
| Access Level | **Standard** |
| Project | **mission-control-v1** (`6abae2b600041e3ecb6a8da4dbe7b4a1`) |
| Project owner | Chris Calabrese |
| Effective project actions | includes **`ADD_TASKS`** (plus Manage-class actions) |

S2S cannot be remapped to `CCalabrese@aaalife.com`. Entered By for S2S creates stays the tech account until Path A (ExC user Bearer) is live.

## Admin steps that fixed it

1. Setup → People → techacct user → Access Level → **Planner** / **Standard** (not Contributor).
2. Open **mission-control-v1** → **Share** → techacct user → **Manage** (Add Tasks).

## Verify

```bash
npm run workfront:sample-create
```

Expect `"ok": true` and a Task `ID`. Then Summary → **Submit to Workfront Que** → success modal → Request Queue → **Refresh from Workfront**.
