# Feature: Distributor Portal

External-facing portal for a distributor to manage their own orders, invoices,
and claims. Route `/distributor`, backed by three endpoints under `/api/distributor/*`.

Implementation:
- Dashboard — [web/app/api/distributor/dashboard/route.ts](../../web/app/api/distributor/dashboard/route.ts)
- Orders (list + status update) — [web/app/api/distributor/orders/route.ts](../../web/app/api/distributor/orders/route.ts)
- Invoices — [web/app/api/distributor/invoices/route.ts](../../web/app/api/distributor/invoices/route.ts)
- Claims (read-only) — [web/app/api/distributor/claims/route.ts](../../web/app/api/distributor/claims/route.ts)
- Order state machine — [web/lib/order-workflow.ts](../../web/lib/order-workflow.ts)
- UI — [web/app/(dashboard)/distributor/page.tsx](<../../web/app/(dashboard)/distributor/page.tsx>)
- Tests — `__tests__/order-workflow.test.ts`

---

## 1. Scope Resolution — a Schema Gap That Had to Be Closed First

`Distributor` had no link to a `User`. Every other portal in this app scopes data
through `Employee.userId` (MR, ASM, RM…); a distributor had no equivalent, so a
logged-in DISTRIBUTOR account could not be mapped to "which distributor is this."

Added `Distributor.userId String? @unique` — nullable because a `Distributor`
record is created from the field (via `/api/manager/entities`) before its portal
login necessarily exists, and unique because at most one account should map to one
distributor. This is the same pattern as `Employee.userId`, not a new one.

**Login needed no new route.** `/api/auth/login` (the generic, role-checked login)
already accepted `DISTRIBUTOR` in its role enum — nothing used it yet, but it works
unchanged.

Access: `DISTRIBUTOR` sees their own account. `ADMIN` may pass `?distributorId=` to
inspect any account, matching the drill-down pattern used everywhere else in this
app (MR dashboard, RM dashboard).

---

## 2. Order Fulfilment State Machine

```
PENDING ──▶ CONFIRMED ──▶ SHIPPED ──▶ DELIVERED
   │            │
   └──▶ CANCELLED ◀──┘
```

| From | Allowed to |
|---|---|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED` |
| `DELIVERED` | *(final)* |
| `CANCELLED` | *(final)* |

**Skipping a stage and moving backward are both rejected**, not just discouraged —
`canTransitionOrder()` in `lib/order-workflow.ts` is called on every update, and the
API returns 400 with the specific reason. This isn't cosmetic: order status feeds
invoice and collections reporting elsewhere in the app, so an inconsistent history
(e.g. `PENDING → DELIVERED` with no confirm/ship step recorded) would corrupt those
numbers, not just look untidy.

**Cancellation is only reachable from `PENDING` or `CONFIRMED`.** Once a distributor
has shipped stock, "cancelling" is a returns/credit-note problem — a `Claim` against
already-moved inventory — not a status flip back to nothing happened.

Verified live end-to-end: `PENDING → CONFIRMED` succeeds; `CONFIRMED → DELIVERED`
(skip) and `CONFIRMED → PENDING` (backward) both correctly rejected with 400 and a
human-readable reason.

---

## 3. Cross-Account Isolation

A distributor can only read or update their **own** orders. Verified live: a second
distributor's order returns 403 on update attempt (`"This order does not belong to
your account"`) and is silently absent from the first distributor's order list —
not filtered client-side, never returned by the query in the first place.

---

## 4. Dashboard Tiles

| Tile | Definition |
|---|---|
| Total Orders | All-time count for this distributor |
| Pending Orders | `PENDING`, `CONFIRMED`, or `SHIPPED` — i.e. not yet finalised |
| Order Value | Sum of order-item value booked this month |
| Outstanding | Sum of unpaid `Invoice.amount` |
| Credit Utilization | Outstanding ÷ `Distributor.creditLimit`, or **`null`** — not `0%` or an error — when no limit is configured |
| Pending Claims | `Claim` rows in `PENDING_MR` or `PENDING_ASM` |

---

## 5. Claims — Read-Only, and Why

The portal shows claims raised against a distributor, but **there is no route to
create or approve one.** `Claim` and `CreditNote` are fully modelled in the schema,
but nothing in this codebase lets an MR raise a return/damage claim or an ASM
approve it — those rows only exist if inserted directly.

Building that workflow was out of scope for "implement the distributor portal";
surfacing it as read-only (empty state when there's nothing yet) was the honest
choice over either skipping the section entirely or half-building a create form
with no approval chain behind it.

---

## 6. Known Limits

- **No pagination UI** on the orders/invoices tables — the API supports it
  (`?page=&limit=`), the page just doesn't expose page controls yet.
- **No claim creation workflow** (see §5) — this is the most consequential gap; a
  distributor can see a claim but the business process that produces one doesn't exist.
- **Credit limit enforcement is informational only.** Utilization over 100% is
  displayed with a warning tone, but nothing blocks a new order from being booked
  against an over-limit account.
- **Invoice generation is not implemented.** `Invoice` rows must be created some
  other way; the portal only reads them.
