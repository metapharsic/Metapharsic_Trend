# dms — Overview

> Generated 2026-07-17 from `server/routes/dms.js`. **7 endpoints.**
> Read [../../architecture/system-architecture.md](../../architecture/system-architecture.md) first.

| | |
|---|---|
| Mount | `/api/dms` |
| Route file | `server/routes/dms.js` |
| Frontend | Documents.tsx |
| Kafka module | DMS |
| Invalidates | /api/dms |
| Key tables | dms_documents, dms_folders, dms_versions, dms_audit_trail |

## Endpoints

| Method | Path | Middleware |
|---|---|---|
| GET | `/api/dms` | auth |
| GET | `/api/dms/stats` | auth |
| GET | `/api/dms/versions` | auth |
| GET | `/api/dms/:id` | auth |
| POST | `/api/dms` | auth |
| PUT | `/api/dms/:id` | auth |
| DELETE | `/api/dms/:id` | auth |

Legend: `auth` = inline `verifyTokenMiddleware` · `auth*` = file-level
`router.use(verifyTokenMiddleware)` · `portal-auth` = `verifyPortalToken` ·
`2fa` = `verify2FAMiddleware`, a **no-op** ([ADR-006](../../decisions/decision-log.md)) ·
`roles:` = `verifyRoleMiddleware` (7 role names are phantom — see
[business-roles.md](../../security/business-roles.md)). A dash means **no auth at all**.

## See also

- [workflows.md](workflows.md) — processes and state changes
- [rules.md](rules.md) — hard rules for this module
- [../../catalog.md](../../catalog.md) — all 467 endpoints
