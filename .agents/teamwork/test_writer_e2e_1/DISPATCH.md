## 2026-11-01T08:01:29Z
You are the E2E Test Writer (test_writer_e2e_1).
Working directory: c:\Trend_MR\.agents\teamwork\test_writer_e2e_1\

MANDATORY FIRST STEP:
Read the verbatim user requirements in c:\Trend_MR\.agents\teamwork\ORIGINAL_REQUEST.md.
Also read:
- c:\Trend_MR\PROJECT.md
- c:\Trend_MR\TEST_INFRA.md
- Existing test patterns in web/__tests__/helpers/api.ts and web/__tests__/entities-crud-wiring.test.ts

Mission & Scope:
Create comprehensive, opaque-box E2E test suites in `web/__tests__/` covering Tiers 1 to 4:
1. `web/__tests__/chemist-doctor-assignment.test.ts` (R1 tests: Tier 1 happy paths, Tier 2 boundary cases like empty doctors, non-existent doctor ID, multiple doctor linking, update/unlink).
2. `web/__tests__/billing-doctor-selection.test.ts` (R2 tests: Tier 1 doctor persistence on order/invoice, Tier 2 boundary cases like null doctor, unassigned doctor selection, assigned pre-filtering verification).
3. `web/__tests__/doctor-profit-analytics.test.ts` (R3 tests: Tier 1 profit calculation using pricing.ts, volume ranking, Tier 2 boundary cases like 0-order doctor, null-doctor historical orders).
4. `web/__tests__/concurrency-performance.test.ts` (R4 tests: Tier 1 multi-threaded worker execution, non-blocking asynchronous calculation, concurrent billing stress).
5. `web/__tests__/e2e-workflow.test.ts` (Tiers 3 & 4: Pairwise cross-feature combinations & real-world workflow scenarios from TEST_INFRA.md).

Important Guidelines:
- Use the established test pattern from `web/__tests__/helpers/api.ts` (`testDb`, `resetFixture`, `tokenFor`, `jsonRequest`).
- Scope boundary: DO NOT modify any application implementation files (`web/app`, `web/lib`, `web/services`, `web/prisma`). You only create test files in `web/__tests__/` and project metadata `c:\Trend_MR\TEST_READY.md`.
- When all test suites are written and verified, create `c:\Trend_MR\TEST_READY.md` summarizing the test suites, runner command, and tier breakdown.
- Write your final handoff report to `c:\Trend_MR\.agents\teamwork\test_writer_e2e_1\handoff.md`.
- Send a completion message to your parent orchestrator with the summary of created test suites and verification results.
