# E2E Test Infra: Trend_MR Chemist Doctor Linking & Profit Concurrency

## Test Philosophy
- Opaque-box, requirement-driven. No internal mock dependencies; exercises HTTP endpoints and UI behaviors as an end-user would.
- Derived strictly from `ORIGINAL_REQUEST.md`.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory & Test Mapping
| # | Feature | Source (Requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Workload) |
|---|---------|---------------------|:-----------------:|:-----------------:|:----------------------:|:-----------------:|
| 1 | Chemist-Doctor Assignment & Persistence | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 2 | Chemist Profile Viewing & Updating | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 3 | Billing Doctor Selection Field & Validation | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 4 | Assigned Doctor Pre-filtering & Priority | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 5 | Non-Assigned Doctor Search & Fallback | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 6 | Billing Transaction & Invoice Doctor Persistence | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 7 | Doctor Sales Revenue & Earned Income Math | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 8 | Doctor Volume Tracking & Top Prescriber Ranking | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 9 | Historical / Unassigned Order Resilience | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 10 | Asynchronous Multi-threaded Worker Execution | ORIGINAL_REQUEST §R4 | ≥5 | ≥5 | ✓ | ✓ |
| 11 | Non-Blocking Billing & Concurrency Guarantees | ORIGINAL_REQUEST §R4 | ≥5 | ≥5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Jest via Node.js
  - Command: `cd web && npx jest __tests__/e2e-workflow.test.ts --runInBand`
- **Pass/Fail Semantics**: Exit code 0, all assertions pass, 0 timeouts.
- **Test Suites Breakdown**:
  - `web/__tests__/chemist-doctor-assignment.test.ts` (Tier 1 & Tier 2 for R1)
  - `web/__tests__/billing-doctor-selection.test.ts` (Tier 1 & Tier 2 for R2)
  - `web/__tests__/doctor-profit-analytics.test.ts` (Tier 1 & Tier 2 for R3)
  - `web/__tests__/concurrency-performance.test.ts` (Tier 1 & Tier 2 for R4)
  - `web/__tests__/e2e-workflow.test.ts` (Tiers 3 & 4: Integrated End-to-End Scenarios)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Chemist Onboarding & Doctor Linkage: Multi-specialty clinic with 3 doctors assigned to a chemist | F1, F2, F3 | Medium |
| 2 | High-Volume Billing with Assigned Doctor: Billing invoice generated for assigned doctor with line items & margin | F3, F4, F6, F7 | High |
| 3 | Emergency Prescriber Override: Dispensing chemist billed with an external unassigned specialist doctor | F4, F5, F6, F7 | Medium |
| 4 | Multi-Doctor Territory Performance Audit: Multiple doctors billed across multiple chemists, top-prescriber ranked | F6, F7, F8, F9, F10 | High |
| 5 | Concurrent Billing & Reporting Stress Test: Rapid concurrent billings and parallel worker-thread analytics aggregation | F6, F10, F11 | High |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥55 test cases (≥5 per feature across 11 features)
- **Tier 2 (Boundary & Corner Cases)**: ≥55 test cases (nulls, empty arrays, invalid UUIDs, zero volume, edge dates)
- **Tier 3 (Cross-Feature Combinations)**: ≥11 pairwise interaction tests
- **Tier 4 (Real-World Scenarios)**: ≥5 end-to-end integration workflows
- **Total Minimum Target**: ≥126 test assertions
