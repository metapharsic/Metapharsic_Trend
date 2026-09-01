# Module: Accounts (Ledger)

Lean, in-house double-entry-lite bookkeeping module. Native to existing stack (Next.js App Router + Prisma + `withAuth`), not a port of any external ERP accounting package. Status: **Phase 1, 2 & 3 shipped.** All 3 reports (Trial Balance, P&L, Balance Sheet) live at `/finance/reports` as tabs.

---

## 1. Design Principle

Reuse existing financial events (`Invoice`, `Collection`, `Expense`, `Payroll`) as ledger sources instead of re-modeling them. Only 3 new Prisma models added. No separate sync service — postings happen inline inside the existing route handler's `$transaction`, same pattern as `web/lib/credit.ts`.

## 2. New Prisma Models (max 3)

- **ChartOfAccount** — `code`, `name`, `type` (ASSET/LIABILITY/INCOME/EXPENSE/EQUITY), `parentId` (self-relation, 1 level), `isSystem` (protects auto-posted accounts from deletion).
- **LedgerTransaction** — `date`, `narration`, `sourceType` (MANUAL/INVOICE/COLLECTION/EXPENSE/PAYROLL), `sourceId` (nullable back-reference).
- **LedgerEntry** — `transactionId`, `accountId`, `debit`, `credit`. `sum(debit) == sum(credit)` enforced in app code per transaction.

Default seed: Cash, Bank, Accounts Receivable–Chemists, Accounts Payable, Sales Revenue, GST Payable, Salary Expense, General Expense (8 accounts).

## 3. Auto-Posting Map

| Existing event | Source file | Scope field | Ledger effect |
|---|---|---|---|
| Invoice created/paid | `web/app/api/invoices/route.ts`, `.../[id]/route.ts` | `employeeId` | Dr AR–Chemists / Cr Sales Revenue + GST Payable |
| Collection logged | `web/app/api/mr/collections/route.ts` | `employeeId` | Dr Cash/Bank / Cr AR–Chemists |
| Expense approved | finance approval route | `employeeId` | Dr Expense category / Cr Cash-Bank or AP |
| Payroll run | payroll create route | company-wide | Dr Salary Expense / Cr Bank + statutory payable |
| CreditNote issued | Claim → CreditNote flow | `employeeId` via Claim | Dr Sales Return / Cr AR |

Posting logic centralized in `web/lib/ledger.ts` via `postAutoLedger(tx, {...})` — called inline inside each route's own `db.$transaction`, same convention as `web/lib/credit.ts`. Shipped integrations:
- `web/app/api/orders/secondary/route.ts` — extends the existing Order+Invoice `$transaction`.
- `web/app/api/invoices/[id]/route.ts` — new `$transaction` wrapping the `paid` toggle; only posts on the unpaid→paid transition.
- `web/app/api/mr/collections/route.ts` — new `$transaction` around `Collection.create`.
- `web/app/api/expenses/claims/[id]/review/route.ts` — new `$transaction`; posts only when `status` becomes `APPROVED`.
- `web/app/api/hrms/payroll/route.ts` — new `$transaction`; since Payroll is an `upsert` (regenerable per employee-month), it deletes any prior `LedgerTransaction` for that payroll id before re-posting, so regeneration doesn't leave stale figures.

**Idempotency**: `postAutoLedger` checks `LedgerTransaction.findFirst({ sourceType, sourceId })` before insert — no-ops if already posted. Verified via a throwaway script: posting twice for the same `sourceId` yields exactly 1 `LedgerTransaction` row, not 2.

## 4. API Routes (shipped)

- `POST/GET /api/finance/accounts` — FINANCE, ADMIN
- `POST/GET /api/finance/journal-entries` — FINANCE (write), FINANCE/ADMIN/MD (read)
- `GET /api/finance/reports/trial-balance` — FINANCE/ADMIN/MD, `db.ledgerEntry.groupBy` per account
- `GET /api/finance/reports/pnl?from&to` — FINANCE/ADMIN/MD, income vs expense over a date range
- `GET /api/finance/reports/balance-sheet?asOf` — FINANCE/ADMIN/MD, assets/liabilities as of a date + computed Retained Earnings line (no Equity postings modeled yet, so cumulative net income keeps the sheet balanced)

All follow `withAuth(handler, roles)` + `ok()/apiError()` envelope. List routes return `pagination.total` (never derive counts from `array.length`).

## 5. Pages (shipped)

- `web/app/(dashboard)/finance/accounts/page.tsx`
- `web/app/(dashboard)/finance/journal/page.tsx`
- `web/app/(dashboard)/finance/reports/page.tsx` — single page, 3 tabs (Trial Balance / P&L / Balance Sheet)

Nav entries gated FINANCE/ADMIN(/MD for reports) in `web/components/dashboard-shell.tsx`.

## 6. Rollout Order

1. **Phase 1** — Chart of Accounts + manual journal entry (no auto-posting).
2. **Phase 2** — Auto-posting from Invoice/Collection/Expense/Payroll events.
3. **Phase 3** — Reports: trial balance, P&L, balance sheet.

## 6b. Edit/Delete Reversal (fixed post-audit)

Auto-posted sources can be edited or deleted after the fact — the initial Phase 2 wiring only covered the *create* path and missed this, caught by the mandated audit:
- `web/app/api/orders/[id]/route.ts` `updateOrderItems` — invoice total changes now call `reverseAutoLedger` + `postAutoLedger` to repost fresh; if the invoice was already `paid`, it's forced back to `paid: false` (and its payment posting reversed) so a stale paid-flag never survives an amount change — the caller must re-confirm payment via `PUT /api/invoices/[id]`.
- `web/app/api/orders/[id]/route.ts` `deleteOrder` — reverses both the sale and (if present) payment ledger postings before the cascade delete removes the Invoice.
- `web/app/api/mr/collections/[id]/route.ts` `updateCollection`/`deleteCollection` — reverse + repost (edit) or reverse only (delete).

`reverseAutoLedger(tx, sourceType, sourceId)` added to `web/lib/ledger.ts` — deletes the prior `LedgerTransaction` (cascades to its entries) for a source key. Verified via script: create → ledger tx count 1; edit (reverse+repost new amount) → still count 1, entries reflect new amount; delete (reverse) → count 0.

## 6c. Seed Safety (fixed post-deep-audit)

`prisma/seed.ts` now seeds `DEFAULT_CHART_OF_ACCOUNTS` inline (imported from `web/lib/ledger.ts`) at the end of `main()` — a fresh environment running `prisma migrate reset` (which re-runs `seed.ts`) will always have the 10 default accounts present. Previously this only lived in a separate `prisma/seed_accounts.ts` that nothing called automatically — any environment that skipped that manual step would have every `postAutoLedger` call throw `"unknown account code(s)"` and block order/collection/expense/payroll creation entirely. `seed_accounts.ts` is kept as a standalone re-run option (also upsert-safe) but is no longer the only path.

## 6d. Stock-Floor Guards (fixed post-deep-audit)

Three stock-decrementing paths had no floor guard — a concurrent booking or an over-reported DCR could push a counter negative:
- `web/app/api/orders/secondary/route.ts` — `Product.stockQty` decrement now uses `updateMany({ where: { stockQty: { gte: quantity } } })`; a zero-count result throws and the route returns `400 Insufficient stock`.
- `web/app/api/orders/[id]/route.ts` `updateOrderItems` — same guard added to its decrement loop; the function was also wrapped in its own try/catch for the first time (it previously had none — an unhandled rejection would have skipped the JSON error envelope entirely).
- `web/app/api/mr/visits/route.ts` — `SampleInventory.quantity` and `GiftCatalog.stockQty` decrements both gained the same `gte`-guarded `updateMany` pattern.

Also fixed: `web/app/api/products/[id]/route.ts` PUT wrapped its `Product.update` + `InventoryMovement.create` pair in `db.$transaction` — previously two separate calls, so a crash between them could change stock with no audit row.

Verified via throwaway scripts: chart-of-accounts upsert-seed is idempotent (10 rows, re-run doesn't duplicate); a forced over-decrement is blocked and the transaction rolls back with `stockQty` unchanged.

## 6e. Deferred Gaps — Now Built

The 5 gaps flagged as "net-new, not sync bugs" in the prior audit round were built out this round, each safely:

1. **Order status state machine unification** — `web/app/api/orders/[id]/route.ts` generic PUT now calls `canTransitionOrder` (`web/lib/order-workflow.ts`) before applying a status change, closing the backdoor around the forward-only PENDING→CONFIRMED→SHIPPED→DELIVERED rule the distributor-specific route already enforced.
2. **ExpenseLimit enforcement + RM/Finance approval chain** — `web/app/api/expenses/claims/[id]/review/route.ts` rewritten around a `STAGE_RULES` table: PENDING_ASM (ASM) → PENDING_RM (RM) → PENDING_FINANCE (FINANCE) → APPROVED. An ASM approval checks `ExpenseLimit` for the claimant's role+category; over-limit auto-escalates to PENDING_RM instead of finalizing. Ledger posting still fires only on the true terminal APPROVED. Role gate widened to `[ASM, RM, FINANCE, ADMIN]`.
3. **Distributor credit enforcement** — `web/app/api/distributor/orders/route.ts` PUT now runs `canPlaceOrder` (`web/lib/credit.ts`) against the distributor's own `creditLimit` at the PENDING→CONFIRMED transition (the commit-to-fulfil moment), summing unpaid invoices across their other orders as outstanding exposure. `creditLimit` was previously display-only.
4. **Distributor claims resolution** — new `web/app/api/distributor/claims/[id]/route.ts` PUT: distributor (or ADMIN) can move an `APPROVED` claim to `COMPLETED` (optionally issuing a `CreditNote`) or `REJECTED`. Still can't touch `PENDING_MR`/`PENDING_ASM` — those stages remain unbuilt MR/ASM-side scope.
5. Verified via script: ExpenseLimit escalation math confirmed (1000 vs 500 limit → escalates; 100 vs 500 → doesn't).

## 6f. MR Claim-Raising Workflow (last deferred gap, now built)

Closes the loop the distributor-side resolution (6e.4) was missing an entry point for. Full chain: MR raises → MR submits → ASM reviews → Distributor resolves.

- `web/app/api/mr/claims/route.ts` — POST creates a claim (territory-scoped to the raising MR's own chemists, default `PENDING_MR`); GET lists with the same isManager/employeeId pattern used everywhere else (ASM/ADMIN see all, MR sees own).
- `web/app/api/mr/claims/[id]/submit/route.ts` — PUT, MR-only, advances their own `PENDING_MR` claim to `PENDING_ASM`.
- `web/app/api/manager/claims/[id]/review/route.ts` — PUT, ASM/ADMIN, `PENDING_ASM` → `APPROVED`/`REJECTED`.
- `web/app/(dashboard)/mr/claims/page.tsx` — MR raises + submits, nav under "My Claims".
- `web/app/(dashboard)/admin/claims/page.tsx` — ASM/ADMIN review queue, nav under "Claims Review".

Verified via script: full lifecycle PENDING_MR → PENDING_ASM → APPROVED → COMPLETED (+ CreditNote) walked end-to-end against the real DB, matches every status transition each route enforces. Typecheck clean.

## 7. Cross-Module Sync Rules (mandatory, per root `CLAUDE.md`)

- Every poster reads the **same scope field** (`employeeId`) the sibling module already uses for that entity — never a second scoping rule (territory vs employeeId) for the same data.
- Dashboard cash tiles (`mr/dashboard`, `manager/dashboard/admin-kpis`) and new ledger-based reports must reconcile to the same totals for a given period; if they differ by design (cash-basis snapshot vs ledger-basis), that difference must be documented, not silent.
- Paginated ledger/journal list endpoints must return and the frontend must read `pagination.total`.
- Aggregate tallies (trial balance, P&L lines) computed server-side via `groupBy`/`aggregate` over the full `where`, never client-summed over one page.
- After each phase, re-check Invoice ↔ Collection ↔ Ledger ↔ dashboard tiles for the same employeeId test case before calling the phase done.

## 8. Explicitly Rejected Alternative

An external Express + raw-SQL 17-table ERP accounting export (`chart_of_accounts`, `journal_vouchers`, `general_ledger`, `payment_vouchers`, `receipt_vouchers`, `tax_configurations`, `budgets`, `fixed_assets`, `cost_centers`, `bank_reconciliations`, `pdc_cheques`) was evaluated and rejected — wrong stack (raw `pg` vs Prisma-only, Express vs Next App Router, custom JWT+2FA vs `withAuth`, non-Tailwind UI kit), and 20+ referenced sibling components/services not included in the export. See rollout notes above for the native replacement instead.
