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

- [x] API route tests: 26 new tests (`api-auth`, `api-workflows`) exercising real handlers against a dedicated `trend_mr_test` database. **102 tests / 9 suites total, all passing.**
- [x] CI pipeline ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)) — Postgres service, schema push, tests, build, audit, on every push and PR.
- [x] Security: 13 advisories → **5 high, 0 critical**. Upgraded next 14.2.35, bcrypt 6, node-cron 4, sharp 0.35. Verified legacy bcrypt-5 hashes still authenticate and bad passwords still fail.
- [x] Creation forms: new `/entities` page (Doctor/Chemist/Distributor create + delete) and hospital/tender forms on `/hospitals`, via a shared `components/modal.tsx`. Verified end-to-end through the browser, including DB persistence and delete.

- [x] **MR Daily Dashboard** (`/mr` + `/api/mr/dashboard`) — all 12 tiles, backed by two rules engines: `lib/field-tracking.ts` (GPS status, travel distance) and `lib/notifications.ts` (10 alert rules). Managers can drill into a rep via `?employeeId=`; MRs get 403 on anyone else. Documented with full decision tables in [mr_dashboard.md](../03_features/mr_dashboard.md). **144 tests / 11 suites.**
  - Added `Order.employeeId` — orders previously recorded only chemist and distributor, so per-rep sales could not be attributed at all.
  - Fixed a GPS defect found in verification: the age calculation clamped negatives to zero, so a future-dated fix (clock skew, or a spoofer post-dating) read as "0 min ago / ACTIVE" forever. Future fixes beyond a 5-minute tolerance are now discarded.

- [x] **RM Dashboard** (`/rm` + `/api/manager/dashboard/rm`) — 6 sections (KPIs, Team, Field Activities, Coverage, Expense, Approvals), 5 recharts (ASM/MR ranking, product sales, area sales, 14-day trend). Built `lib/hierarchy.ts` for org-subtree resolution, reused by every manager-level dashboard above ASM. Documented the deliberate difference between region-level sales attribution (chemist's territory) and payroll's collections-based attribution. Verified live with a real RM→ASM→MR hierarchy.
- [x] **Fixed a real infrastructure bug found while adding the RM route**: 54 files each called `new PrismaClient()` independently, opening a separate connection pool per file. This finally exceeded Postgres's `max_connections` (100) once the test suite imported enough route modules into one process — "sorry, too many clients already" started failing ~12 tests. Migrated every route/job to the shared singleton at `lib/db.ts` (which already existed but nothing used it).
- [x] `__tests__/hierarchy.test.ts` — growth/achievement percent edge cases (zero base, zero target), dense ranking with ties, role filtering. **158 tests / 12 suites.**

- [x] **Distributor Portal** (`/distributor` + `/api/distributor/*`) — dashboard KPIs, order list with forward-only status transitions, invoices, read-only claims. Closed a real schema gap: `Distributor` had no `userId`, so no logged-in account could be scoped to "which distributor is this" — added `Distributor.userId String? @unique`, mirroring `Employee.userId`. Login needed no new route; `/api/auth/login` already accepted `DISTRIBUTOR`. Built `lib/order-workflow.ts` (PENDING→CONFIRMED→SHIPPED→DELIVERED state machine, rejecting stage-skips and backward moves) and verified live: valid transition succeeds, skip and backward both 400 with a specific reason, cross-distributor order access correctly 403s and is absent from listings.
- [x] `__tests__/order-workflow.test.ts` — every transition edge (skip, backward, no-op, final-state finality) + credit-utilization null/zero-limit guards. **171 tests / 13 suites.**

- [x] **MR Workflow & Mobile Services**:
  - Standardized MR password in seed to `mr12345` (≥6 characters).
  - Built `mobile/services/*` (`auth`, `visit`, `order`, `tourplan`, `expense`, `storage`) replacing all static placeholder data.
  - Added interactive stock return & damage claim creation modal (`RaiseClaimModal`) in `/mr` dashboard.
  - Implemented offline local storage queue in `mobile/services/storage.service.ts` for field resiliency.

- [x] **Standardized Chart of Accounts (COA)** (`web/lib/ledger.ts`):
  - Expanded master chart of accounts to 30 standard double-entry accounts (covering Cash, Bank, AR, Contra-AR, Inventory, Samples, Input/Output CGST/SGST/IGST, Sales, Discounts, Marketing, Logistics, Salaries, Bad Debts).
  - Seeded into both `trend_mr` and `trend_mr_test` databases.

- [x] **AI Brain Knowledge Engine (`/brain`)**:
  - Established root `/brain` directory with structured architecture memory, multi-agent council specs, ledger standards, and cross-module consistency guides for Gemini and Claude.

- [x] **Checkpoint Snapshot (`docs/checkpoints/snapshots/2026-08-17_13-59-21`)**:
  - Captured verified system milestone snapshot.

- [x] **QA & Verification**:
  - **17 test suites / 204 tests passing (100% Pass).**
  - **0 TypeScript compilation errors** across Web and Mobile.

## Active Task (CURRENT CONTEXT)
All four development phases, MR user workflows, mobile service integrations, and standard double-entry accounting foundations are fully operational and verified.

## Next Up
- [ ] External service credential integration (OCR API key, AWS Rekognition, Anthropic key).
- [ ] Selenium E2E browser automated test specs.
