# Workstart Task ACL (decisions 058 / 059)

After each New Project create in **TEST PORTFOLIO - CHRIS**, Mission Control creates a Task named
**Workstart** on:

| Field | Value |
| --- | --- |
| Parent project | `6afaae95029356651c144f998b870ea4` (**Mission Control Main**, decision 061; replaces the deleted Communications effort project `6afa92ea…`) |
| Task name | `Workstart` |
| Assignments | Chris Calabrese (`690946b90001f53ab97763a1753be08f`, `CCalabrese@aaalife.com`) |

## Required S2S access

The IMS S2S tech account needs **Add Tasks** (and enough project view access to POST `TASK`) on
project `6afaae95…`. Share that project with the tech account if create returns a sufficient-access
error in `workstart.error` while the New Project itself succeeds.

Env overrides (server only, never `VITE_*`):

- `WORKFRONT_WORKSTART_PROJECT_ID`
- `WORKFRONT_WORKSTART_ASSIGNEE_ID`
