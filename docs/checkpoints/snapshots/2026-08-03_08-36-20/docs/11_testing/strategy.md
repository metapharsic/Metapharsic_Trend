# Testing Strategy

This strategy outlines automated and manual validation rules for Pharma OS core modules.

---

## 0. Current Test Suite Status

`npm test` runs **102 tests across 9 suites**, all passing (~15s). Coverage by phase QA gate:

| Suite | Covers | Phase gate |
|---|---|---|
| `gps.test.ts` | Geofence 100m boundary | Phase 1 Week 4 |
| `date.test.ts` | UTC date normalization — **regression test** for a bug where local midnight on an IST server resolved to the previous UTC day, silently breaking every "today" query | Cross-cutting |
| `dps.test.ts` | DPS scoring, clamping, all tier boundaries | Phase 3 Week 9 |
| `cqs.test.ts` | Call Quality Score components and composite | Phase 3 (kpi_formulas §1) |
| `compliance.test.ts` | Travel-speed anomaly detection, receipt date policy, route optimization | Phase 3 Weeks 10–12 |
| `payroll.test.ts` | Incentive slabs, statutory deductions, divide-by-zero target | Phase 4 Week 15 |
| `scheme.test.ts` | Margin projection, negative-margin detection, discount selection | Phase 4 Week 16 |
| `api-auth.test.ts` | Route-level authorization: missing/malformed/forged tokens, per-role access, validation and conflict handling | Cross-cutting |
| `api-workflows.test.ts` | TP approval gating DCR, geofence enforcement, CQS scoring, discount application, duplicate receipts, leave freezing the calendar, KPI updates | Phases 2–4 |

### Running the API tests

API suites call the real route handlers against a **separate database** so they never
touch dev data. `jest.setup.api.js` points `DATABASE_URL` at `trend_mr_test`
(override with `TEST_DATABASE_URL`). Provision it once:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trend_mr_test?schema=public" npm run test:setup
```

Jest runs with `maxWorkers: 1` because the API suites truncate and rebuild shared
fixtures — parallel workers would race each other.

**Not yet covered:**
- Selenium browser E2E (§2 below) — dependency is installed, no specs written.
- Offline sync conflict resolution — mobile feature does not exist yet.
- The 80% coverage target in §3 is not measured; no coverage gate is enforced.
- `tsconfig.json` excludes `__tests__` from typechecking, so type errors in specs
  surface at runtime rather than at build time.

CI runs the suite plus a build on every push and PR: [.github/workflows/ci.yml](../../.github/workflows/ci.yml).

---

## 1. Automated Integration Tests

All backend services must pass integration test criteria before production deployment:

- **OCR receipt checks**: Mock OCR outputs containing:
  - Exact duplicates (matches `receiptHash` -> asserts `400 Bad Request`).
  - Dates matching weekend holidays (asserts policy warning flags).
- **Offline DB Sync checks**: Simulates database inserts using simulated latency lags (asserts conflict resolution rules run successfully).
- **Geofence Coordinate mocks**: Simulates visit coordinate pings:
  - Inside Geofence range (< 100m -> asserts visit allowed).
  - Outside Geofence range (>= 100m -> asserts geofence validation fails).
- **GPS Mock Spoofing**: Simulates coordinates provider containing mocked location signatures (asserts employee is locked out).

---

## 2. Automated End-to-End Tests (Selenium)

Pharma OS implements **Selenium WebDriver** browser automation checking UI/UX workflows:
- **Test environment**: Standalone chrome driver running locally on port `4444`.
- **Targets**:
  - Web Admin Dashboard login authentication.
  - Institutional Tender form inputs and validations.
  - Expense Auditing panels (verifying flags and rejection notes).

---

## 3. Coverage Requirements
- Minimum **80%** test coverage on all core controllers and database services.
- Mandatory schema validations (`prisma validate`) must occur before any migration creation.

