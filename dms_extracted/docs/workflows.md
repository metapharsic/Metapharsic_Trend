# dms — Workflows

> Generated 2026-07-17. Cross-module state machines live in
> [../../workflows/README.md](../../workflows/README.md) — check there before adding a new one.

## Event propagation

A non-GET to `/api/dms` emits Kafka module **DMS** and invalidates: /api/dms

Verify after any change:
```sql
SELECT topic, event_type, module, created_at
FROM kafka_events ORDER BY created_at DESC LIMIT 5;
```

## State machines

Status transitions must go through `guardTransition()` (`server/utils/workflowGuard.js`) with
enums from `server/constants/workflowStates.js` (`ORDER_STATES`, `LEAD_STATES`,
`INVOICE_STATES`, `PARTY_STATUSES`).

- **Upload** → `dms_documents` (file to disk) → `dms_audit_trail`.
  Required: `title and category`, `Document file is required`.
- **Version** → `dms_versions` — re-upload should version, not overwrite.
- **Delete** → soft (`deleted_at`) only.
- **Stats** → real `SUM(file_size)` → `storageBytes` / `storageUsed`. (Previously a hardcoded
  `'13.5 GB'` mock in `Documents.tsx`.)
- `dms_workflows` and `dms_folders` exist; confirm what is actually wired before relying on them.

## Downstream writes

Tables this module touches: dms_documents, dms_folders, dms_versions, dms_audit_trail

If a flow here writes a table owned by another module, it belongs in
[../../architecture/dependency-map.md](../../architecture/dependency-map.md) too.
