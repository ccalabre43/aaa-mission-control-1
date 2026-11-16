# Workstart Task ACL (decision 058)

After each New Project create in **TEST PORTFOLIO - CHRIS**, Mission Control creates a Task named
**Workstart** on:

| Field | Value |
| --- | --- |
| Parent project | `6afa92ea025f5c90f681bf8ad1cc522a` (Communications effort via poster and email) |
| Task name | `Workstart` |
| Assignments | Pat Gaskin (`641cb8d100053883a2499c4f0ac41735`, `PGaskin@aaalife.com`) |

## Required S2S access

The IMS S2S tech account needs **Add Tasks** (and enough project view access to POST `TASK`) on
project `6afa92ea…`. Share that project with the tech account if create returns a sufficient-access
error in `workstart.error` while the New Project itself succeeds.

Env overrides (server only, never `VITE_*`):

- `WORKFRONT_WORKSTART_PROJECT_ID`
- `WORKFRONT_WORKSTART_ASSIGNEE_ID`
