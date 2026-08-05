# Feature: Regional Manager Dashboard

The RM manages multiple ASMs, each managing their own MRs. Route `/rm`, backed by
`GET /api/manager/dashboard/rm`.

Implementation:
- API — [web/app/api/manager/dashboard/rm/route.ts](../../web/app/api/manager/dashboard/rm/route.ts)
- Org hierarchy resolution — [web/lib/hierarchy.ts](../../web/lib/hierarchy.ts)
- UI — [web/app/(dashboard)/rm/page.tsx](<../../web/app/(dashboard)/rm/page.tsx>)
- Tests — `__tests__/hierarchy.test.ts`

---

## 1. Scope Resolution

An RM's scope is **every employee transitively beneath them** in `Employee.managerId`,
resolved breadth-first in `resolveTeam()` — one query per org level rather than a
recursive CTE, so it stays portable across the deployment targets this project might
end up on. A depth cap (12 levels) and a `seen` set guard against a mis-entered
`managerId` cycle hanging the request.

The region's **territory footprint** is every `Territory` owned by the RM or anyone
in their subtree — not a fixed "region" field on the employee. An RM inherits
whatever territories their ASMs (and those ASMs' MRs) actually hold.

Access: `RM`, `ZSM`, `NSM`, `MD`, `ADMIN` can call the route. Only `ADMIN` may pass
`?employeeId=` to view another manager's region — an RM viewing a different RM's
numbers is not a permission this project grants.

---

## 2. Sales Attribution — a Deliberate Inconsistency

**Regional Sales, Region Ranking, Product Sales, and Area-wise Sales are all
attributed to the chemist's territory**, not the booking rep's reporting line.
In pharma distribution the geography owns the sale: if an MR from a neighbouring
territory books an order for a chemist in this region, it counts as this region's
revenue.

**This differs on purpose from the payroll incentive engine** ([lib/payroll.ts](../../web/lib/payroll.ts)),
which pays on *collections banked* by the employee, not order value by territory.
A rep's incentive should reflect money actually collected under their name; a
region's sales figure should reflect what moved through its geography regardless
of who booked it. Conflating the two would either underpay collections-focused
reps or overcredit a region for orders it didn't touch.

---

## 3. The Six Sections

| Section | Tile | Definition |
|---|---|---|
| **KPIs** | Regional Sales | Chemist-territory-attributed order value, this month |
| | Target Achievement % | Regional sales ÷ sum of `Target.value` across the RM + subtree, overlapping this month |
| | Region Ranking | Dense rank of this region's sales among **all** regions company-wide |
| | Monthly Growth | % change vs last month; **`null`** (not `∞%`) when last month was zero |
| | Product Performance | Top-selling products this month by revenue |
| **Team** | Total ASMs / Total MRs | Count by role within the subtree |
| | Attendance | Present today ÷ team size |
| | Active Users | `User.isActive` count across the subtree |
| **Field Activities** | Today's Visits / Doctor / Chemist / Hospital Calls | `Visit` rows today, split by target type |
| | Missed Calls | Approved TP days in the past with no matching visit (same rule as the Admin Dashboard KPI, scoped to the subtree) |
| | Follow-ups Due | `Visit.followUpDate` on or before today |
| **Coverage** | Doctor / Chemist Coverage % | Unique entities visited this month ÷ entities in the region's territories |
| | Territory Coverage | Territories with **any** visit this month ÷ territories held |
| | New Doctor Registration | Doctors created this month within the region's territories |
| **Expense** | Regional Expenses | `Expense.amount` sum, RM + subtree, this month |
| | Pending / Approved Claims | By status, subtree-scoped |
| **Approvals** | DCR Approval | Anomaly-flagged visits with no reviewer decision yet — see §4 |
| | Tour Plan / Leave / Expense Approval | Pending counts, subtree-scoped |

---

## 4. "DCR Approval" Mapping

The spec asked for a "DCR Approval" tile. There is no separate DCR-approval workflow
in the schema — a DCR *is* the `Visit` record, submitted and geofenced at creation
(Phase 1 Week 4). What **does** need a manager decision after the fact is an
anomaly-flagged visit: `Visit.anomalyFlag = true` with no `AnomalyReview` yet
resolved to `DISMISSED` or `CONFIRMED`. That count is what this tile shows.

If "DCR Approval" was meant to describe a different workflow — visits requiring
sign-off before they count toward KPIs, for instance — that is a schema change, not
a query change, and is flagged in the gap analysis rather than guessed at here.

---

## 5. Performance Charts

| Chart | Computation |
|---|---|
| ASM Ranking | Each ASM's score is their **own visits plus every descendant's** (their MRs, and anyone below those) — an ASM with zero personal visits but a productive team still ranks appropriately |
| MR Ranking | Individual visit count this month, top 8 |
| Product Sales | Top 8 products by revenue this month |
| Area-wise Sales | Top 8 territories by revenue this month |
| Daily Trend | 14-day rolling visits + sales, dual y-axis |

Rankings and top-N lists cap at 8 entries — enough to be useful without becoming
unreadable as the org grows.

---

## 6. Known Limits

- **Growth and coverage have no pacing tolerance** the way the MR dashboard's
  notification rules do. A region 3 days into the month with low coverage reads
  identically to one that's genuinely behind — there's no equivalent of
  `COVERAGE_BEHIND_PACE`'s month-elapsed adjustment here yet.
- **`resolveTeam` is O(depth) queries, not O(1).** Fine for the 5-6 level org this
  schema models; would need a materialized closure table or recursive CTE if the
  hierarchy ever grew deep enough for query count to matter.
- **No RM-level notification feed.** The MR dashboard has one; this doesn't. The
  Approvals section shows counts but no derived urgency or next-action guidance.
- **Region Ranking assumes one primary region.** `manager.regions` can list several
  if the subtree spans multiple `Territory.region` values; the ranking KPI only
  ranks the first one.
