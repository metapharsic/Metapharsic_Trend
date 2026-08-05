# Phase 2 Implementation Plan: Core CRM & Distribution Setup

**Timeline**: Weeks 5-8

---

## 🎯 Target Objectives & Scope
Deliver master profiles (Doctor, Chemist, Distributor), Monthly Tour Plan calendar approvals, SKU-level product catalogs (MRP, PTR, PTS pricing), and secondary sales ordering.

---

## 📅 Week-by-Week Breakdown

### Week 5: Master Profiles & Territory Mapping — ✅ Done
- **Database**: `Doctor`, `Chemist`, `Distributor` tables live in Postgres.
- **Backend APIs**: `/api/manager/entities` (GET/POST) and `/api/manager/entities/[id]` (PUT/DELETE) — CRUD for all three entity types, including WhatsApp/specialty (Doctor) and license/GST (Chemist/Distributor) fields.
- **Frontend (Web)**: Territory Tree & Assignment UI live at `/territories` — zone → region grouping, employee assignment dropdown per territory.

### Week 6: Product Catalog & e-Detailing Slides — ◐ Partial
- **Database**: `Product` table live (composition, strength, packSize, MRP/PTR/PTS pricing).
- **Backend API**: `/api/products` (CRUD) and `/api/products/visual-aids` (GET) built.
- **Mobile**: PDF/Video viewer carousel + auto page-view duration logging — not yet implemented.

### Week 7: Tour Plan (TP) Calendar Workflows — ✅ Done
- **Workflows**: `/api/sfa/tour-plan/submit` (MR) — upserts a `TourPlan` per employee/month, replaces its `TourPlanDay` rows.
- **Approvals**: `/api/sfa/tour-plan` (GET, role-scoped list), `/api/sfa/tour-plan/approve`, `/api/sfa/tour-plan/reject` (ASM/ADMIN). Web UI at `/tour-plans`.
- **Validation**: `/api/mr/visits` POST now blocks doctor check-ins unless the doctor is on an `APPROVED` TourPlanDay for today — verified live (unplanned doctor → 400, planned doctor → 200).
- **Bug found & fixed while wiring this up**: `/api/mr/visits` never used the app's JWT auth (`withAuth`) — it read a nonexistent `x-user-id` header, so DCR submission was uncallable by any real client. Rewired to `withAuth` like every other route.
- **Bug found & fixed**: date-range queries against `@db.Date` columns (`Attendance.date`, `TourPlan.month`, `TourPlanDay.date`) used server-local midnight; on an IST server (+5:30) that shifts one UTC day back from the stored date, silently breaking "today" comparisons. Added `web/lib/date.ts` (`startOfUtcDay`/`startOfUtcMonth`) and applied it everywhere a Date-only column is read or written.

### Week 8: Order Booking & Basic Expense Claims — ◐ Partial (core done, discount engine deferred)
- **Ordering**: `/api/orders/secondary` (POST create, GET list) — prices line items at `Product.ptr`, routes to the distributor supplied in the request. Status updates via `/api/orders/[id]` (ASM/ADMIN). Web UI at `/orders`.
- **Expense Logging**: `/api/expenses/claims/upload` (MR, multipart) — sha256-hashes the receipt file and rejects exact-duplicate re-submissions. `/api/expenses/claims` (list) and `/api/expenses/claims/[id]/review` (ASM/ADMIN approve/reject). Web UI at `/expenses`.
- **QA Gate**: Verified live via curl — order creation with correct PTR pricing, duplicate-receipt-hash rejection (409), and Admin Dashboard KPIs (Orders/Sales/Expenses/Pending Approvals) picking up the new records in real time.
- **Deferred**: "auto-apply discount schemes" from the original spec has no `DiscountScheme` model in `production_schema.prisma` — orders currently price straight off `Product.ptr`. Flagged in gap analysis.
- **Bug found & fixed**: seeded MR password (`mr123`, 5 chars) failed the login schema's own `min(6)` rule — the MR account could never log in. Changed to `mr12345`.
