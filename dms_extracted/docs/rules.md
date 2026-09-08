# dms — Rules

> Generated 2026-07-17. Read before changing `server/routes/dms.js`.

## Global rules (apply here too)

These are not optional and are not repeated per rule below. Full text:
[../../standards/coding-standards.md](../../standards/coding-standards.md).

1. **GL/batches are truth.** Never read `parties.current_balance`, `products.current_stock`,
   or `fixed_assets.current_value` to make a decision. Use `utils/creditRules.js` /
   `utils/stockRules.js`.
2. **Stock + GL only via `utils/ledgerHelper.js`** — `postToStockLedger()`,
   `postToGeneralLedger()`.
3. **Revenue excludes cancelled**: `UPPER(status) NOT IN ('CANCELLED','RETURNED')`.
4. **Status compares are case-insensitive** — use `UPPER()`/`LOWER()`.
5. **Multi-table writes** use `db.getClient()` + `BEGIN`/`COMMIT`/`ROLLBACK`, released in `finally`.
6. **No in-memory shared state** — PM2 runs 2 workers.
7. **If you write a table another module reads**, add its key to `resolveInvalidateKeys`
   ([../../architecture/event-bus.md](../../architecture/event-bus.md)).
8. Run GitNexus `impact` before editing a symbol; `detect_changes()` before commit.

## Module-specific rules

### 1. Storage figures must be real
`/stats` computes `SUM(file_size)` → `storageBytes`/`storageUsed` via `fmtStorage()`.
`Documents.tsx` previously hardcoded `'13.5 GB' // Mock value` and shipped for months. **Never
put a placeholder in a production path.**

### 2. Soft delete only
Documents use `deleted_at`. Never hard-delete a document row.

### 3. Every mutation writes `dms_audit_trail`
Keep it that way — DMS is a controlled-document store.

### 4. Validation
`title and category are required`; `Document file is required`.

### 5. Versions are first-class
`dms_versions` exists — a new upload of the same document should version, not overwrite.

## Owned tables

dms_documents, dms_folders, dms_versions, dms_audit_trail

## Related decisions

See [../../decisions/decision-log.md](../../decisions/decision-log.md).
