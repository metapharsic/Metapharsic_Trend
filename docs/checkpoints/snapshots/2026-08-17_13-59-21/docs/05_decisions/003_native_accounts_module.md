# ADR 003: Native Accounts Module (Not External ERP Port)

## Status
Accepted

## Context
An external accounting export (`accounts_module_export.zip`) was evaluated for reuse — a 17-table double-entry ERP accounting system (chart of accounts, journal vouchers, general ledger, payment/receipt vouchers, budgets, fixed assets, cost centers, bank reconciliation, PDC cheques, tax configurations).

It was built for a different stack: Express + raw `pg` SQL (no ORM), custom JWT + 2FA middleware, non-Tailwind in-house UI kit, and referenced ~20 sibling components/services not included in the export. Trend MR is Prisma-only (no raw SQL driver installed), Next.js App Router (`route.ts` + `withAuth` HOF), and Tailwind-styled.

## Decision
Reject the port. Build a lean, native accounts module instead:
- Max 3 new Prisma models (`ChartOfAccount`, `LedgerTransaction`, `LedgerEntry`) instead of 17 raw SQL tables.
- Auto-post from existing events (`Invoice`, `Collection`, `Expense`, `Payroll`) inline in existing route handlers' `$transaction`, instead of a separate sync service.
- Follow existing `withAuth`/`ok()`/`apiError()` conventions, not a new response envelope.
- Phased rollout: Chart of Accounts + manual journal → auto-posting → reports (trial balance, P&L, balance sheet).

Full plan: [docs/03_features/module_accounts.md](file:///c:/Trend_MR/docs/03_features/module_accounts.md).

## Consequences
- Smaller surface, faster to ship, stays in sync with existing scope rules (`employeeId`-based, per root `CLAUDE.md` mandate).
- Does not natively support advanced ERP features (multi-currency FX, PDC cheque tracking, GST/TDS compliance automation, bank reconciliation, budgets, fixed-asset depreciation) — those remain future scope if ever needed, built as later phases on the same 3-model foundation rather than imported wholesale.
