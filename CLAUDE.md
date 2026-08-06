# Trend MR Pharma OS — mandatory process

## Cross-module consistency check (required before any modification)

This app has many screens pulling the same underlying data through different
API routes (orders, invoices, collections, dashboards, reports). These routes
have drifted out of sync before — e.g. `/api/orders/secondary` scoped MRs by
chemist territory while `/api/invoices` and `/api/orders/history` scoped by
`order.employeeId`, producing a page where "Generated Invoices" showed more
rows than "Sales Orders" for the same MR. Silent pagination truncation
(fetching a list but never surfacing `pagination.total`) is the other
recurring failure mode.

**Before starting any code change in this repo**, run a short `Explore`
(or `general-purpose`) agent pass — or do the check inline if it's a single
obvious file — to verify:

1. Every API route touching the module being changed uses the **same scope
   rule** for the same role (e.g. all MR-facing endpoints for "my X" scope by
   `employeeId`, not a mix of territory/employee/chemist filters).
2. Any list endpoint that paginates (`skip`/`take`) returns `pagination.total`
   AND the calling page actually reads it — never derive a header count or
   status tally from `array.length` on a paginated fetch.
3. Aggregate tallies (status counts, KPI tiles) are computed server-side over
   the full `where` clause, not client-side over a single fetched page.
4. Cross-check the affected module against its siblings (e.g. changing
   orders → also check invoices, collections, ledger history) for the same
   scoping/pagination class of bug before considering the task done.

This is not optional cleanup — treat it as part of the definition of done for
any change touching data fetched across more than one screen.
