# Current Workflow & Tasks

This is the living document tracking our current sprint.

## Completed Tasks
- [x] Define platform positioning and architecture blueprint.
- [x] Create AI-optimized documentation structure (`/docs`).
- [x] Align SFA, CRM, HRMS, and Expense specifications with database models.
- [x] Expand database schema (`production_schema.prisma`) to support all modules.
- [x] Complete folder consistency updates (PRD, API, UI screen layouts, Gaps, Test strategies).
- [x] Scaffold web backend as Next.js 14 App Router (API routes under `web/app/api`) with Prisma + PostgreSQL — supersedes the earlier NestJS plan.
- [x] Scaffold mobile app as Expo/React Native (`mobile/app`) — supersedes the earlier Flutter plan.
- [x] Wire `web/prisma/schema.prisma` to `docs/02_database/production_schema.prisma`, provision local Postgres (`trend_mr` db), run `db push` + seed.
- [x] Build shared API response/auth/gps/upload libs (`web/lib/*`) — were referenced by routes but missing.
- [x] Phase 1 MVP: auth (manager/MR login, refresh), attendance check-in/out, geofenced DCR visit submission, anomaly detection job.
- [x] Phase 2 Week 5: Doctor/Chemist/Distributor master profiles + territory tree assignment UI (`/territories`).
- [x] Phase 2 Week 6: Product catalog CRUD (`/api/products`) + e-detailing visual aids listing (`/api/products/visual-aids`).
- [x] Wire up Tailwind (was never configured — no config/globals.css existed). Establish design system: primary emerald palette, Inter/Outfit fonts.
- [x] Build dashboard shell (sidebar + topbar) and `/login` page; apply theme app-wide.
- [x] Build Admin Dashboard KPI panel (`/admin`) backed by `/api/manager/dashboard/admin-kpis` — workforce, coverage, commercial, approvals/compliance, performance, inventory metrics.
- [x] Phase 2 Week 7: Tour Plan submit/approve/reject (`/api/sfa/tour-plan/*`) + DCR check-in blocking against unapproved TP days. Web UI at `/tour-plans`.
- [x] Phase 2 Week 8: Secondary order booking (`/api/orders/secondary`, `/api/orders/[id]`) + expense claim upload with duplicate-receipt hash detection (`/api/expenses/claims/*`). Web UI at `/orders`, `/expenses`.
- [x] Fixed critical bug: `/api/mr/visits` (DCR submission) was never wired to real JWT auth — it read a nonexistent `x-user-id` header. Now uses `withAuth` like every other route.
- [x] Fixed critical bug: `@db.Date` column comparisons (`Attendance.date`, `TourPlan.month`, `TourPlanDay.date`) used server-local midnight instead of UTC midnight, silently off-by-one-day on non-UTC servers. Added `web/lib/date.ts`.
- [x] Fixed bug: seeded MR password was 5 chars, failing its own login schema's 6-char minimum — MR account could never log in.

- [x] Phase 3 Week 9: DPS scoring engine (`lib/dps.ts`, nightly job, `/api/manager/doctors/dps`, `/doctors` UI). Reconciled a formula conflict between `phase_3_ai.md` and `kpi_formulas.md`, and added the input normalization the formula needs to produce scores inside its own tier bands.
- [x] Phase 3 Week 10: route optimization (`lib/route-optimizer.ts` nearest-neighbour, `/api/sfa/route-plan`).
- [x] Phase 3 Week 11: OCR provider boundary (`lib/ocr.ts`) + receipt date validation. Extraction blocked on credentials.
- [x] Phase 3 Week 12: mock-GPS auto-lock job + `/api/manager/compliance` (scan/unlock); PharmaChat MCP query tool layer (`lib/pharmachat.ts`, `/api/ai/pharmachat`). NL routing blocked on API key.
- [x] Phase 4 Week 13: Hospital CRM, `HospitalTender`, `HospitalFormulary` models + APIs.
- [x] Phase 4 Week 14: LMS courses/enrollments with quiz scoring and completion gating.
- [x] Phase 4 Week 15: HRMS leave approval (freezes tour-plan days) + payroll incentive engine (`lib/payroll.ts`), `/hrms` UI.
- [x] Phase 4 Week 16: 10-report BI library (`/api/reports`, `/reports` UI) + Scheme Margin Simulator (`/api/simulator/scheme`, `/simulator` UI).

- [x] **QA Gates** (specified in every phase, previously unmet): 76 unit tests across 7 suites, all passing. Covers geofence, UTC-date regression, DPS, CQS, anomaly detection, receipt policy, route optimization, payroll slabs, and scheme margins. See [testing strategy §0](../11_testing/strategy.md).
- [x] Applied `DiscountScheme` to `/api/orders/secondary` — best qualifying scheme per line, verified live (₹120 → ₹114 at the 50-unit threshold).
- [x] Closed the `Visit.hospitalId` gap — hospital visits are loggable and geofenced; "Hospitals Covered" KPI now reports real coverage (verified 0/1 → 1/1).
- [x] Implemented real CQS (`lib/cqs.ts`), scored at DCR submission, replacing the `salesConversionRate` proxy in DPS. Verified live: CQS 100 moved the seeded doctor 29.5 → 39.5, tier C → B.
- [x] Added `/hospitals` (institutional sales) and `/lms` (training) UI pages.

## Active Task (CURRENT CONTEXT)
All four phases are built, tested, and verified live against seeded Postgres. Every phase QA gate now has automated coverage.

## Next Up
- [ ] **Blocked on credentials only** (interfaces exist, see gap analysis §8–10): receipt OCR extraction, PharmaChat natural-language routing, biometric face match.
- [ ] Mobile app: Expo client is scaffolded but has no tour-plan, route-map, e-detailing viewer, or offline (RxDB) sync. No MR-facing web login page either — MR flows are verified via direct API calls.
- [ ] API route handlers have no automated tests (unit-tested logic only). Needs a test database and request harness.
- [ ] Selenium E2E specs — dependency installed, no specs written. No CI pipeline exists, so nothing runs the suite automatically.
- [ ] Frontend CRUD *forms* — Doctors/Chemists/Distributors, hospital/tender creation, and LMS progress updates are API-only; the UI pages are read-only views.
- [ ] `npm audit` reports 13 vulnerabilities (2 critical, 9 high), including a known Next.js 14.2.5 advisory.
