# Handoff Report: Analytics, Concurrency & Test Architecture Survey

**Investigator**: `teamwork_explorer` (Explorer Survey 3)  
**Date**: 2026-11-01  
**Scope**:
1. Profit & Earned Income reporting & analytics views, calculation logic, queries, and current data structures (frontend and backend).
2. Existing test suites (unit, integration, E2E), test runners, test scripts in `web/` and root, and database seed scripts. Execution commands and status.
3. Current concurrency/asynchronous processing patterns (worker threads, async endpoints, queues, background tasks) and design recommendations for R4.

---

## 1. Observation

### 1.1 Profit & Earned Income: Single Source of Truth, Calculation Logic, and Data Structures

- **Single Source of Truth (`web/lib/pricing.ts`)**:
  - `costBasis(product: PricedProduct)` (lines 164–193): Resolves product cost per unit strictly through a hierarchy:
    1. `purchaseRate` (exact cost paid to manufacturer, `exact: true`).
    2. `ptr` (steps down to cost via `costFromPtr = ptr / (1 + companyMarkup/100)`).
    3. `pts` (steps down via `cost = pts / (1 + companyMarkup/100)`).
    4. `price` (MRP-derived, steps down via chemist margin then company markup).
    5. fallback `0` (`source: "none"`).
  - `profitFor(lines: ProfitLine[])` (lines 225–253): Computes revenue and cost:
    - `revenue = sum(unitPrice * quantity)`
    - `cost = sum(basis.value * (quantity + freeQty))` — Note: free quantity (`freeQty`) is strictly charged at cost, not selling price.
    - `profitAmount = revenue - cost`
    - `profitPct = revenue === 0 ? null : (profitAmount / revenue) * 100`
  - `purchaseProfitFor(lines: PurchaseProfitLine[])` (lines 303–335): Computes strict purchase-cost-only profit with `unpricedUnits` tracking and `complete` boolean flag.
  - `COST_BASIS_SELECT` (lines 256–263): The Prisma product select query fragment required across all modules to ensure zero divergence:
    ```ts
    export const COST_BASIS_SELECT = {
      id: true,
      purchaseRate: true,
      pts: true,
      ptr: true,
      price: true,
      marginStructure: true,
    } as const;
    ```
  - Contract protection: `web/__tests__/contracts/pricing-consistency.test.ts` statically scans all codebase files to forbid hardcoded margin multipliers (e.g. `ptr * 0.88`) and rogue fallback chains outside `lib/pricing.ts`.

- **Prisma Schema Data Structures (`web/prisma/schema.prisma`)**:
  - `model Order` (lines 430–451):
    ```prisma
    model Order {
      id            String       @id @default(uuid())
      status        OrderStatus  @default(PENDING)
      chemistId     String?
      chemist       Chemist?     @relation(fields: [chemistId], references: [id])
      doctorId      String?
      doctor        Doctor?      @relation(fields: [doctorId], references: [id])
      distributorId String
      distributor   Distributor  @relation(fields: [distributorId], references: [id])
      employeeId    String?
      employee      Employee?    @relation(fields: [employeeId], references: [id])
      items         OrderItem[]
      invoice       Invoice?
      createdAt     DateTime     @default(now())
      updatedAt     DateTime     @updatedAt
      ...
    }
    ```
    *Observation*: `Order` **already** defines `doctorId String?` and `doctor Doctor?` in the schema.
  - `model Invoice` (lines 857–892):
    Has a 1-to-1 relation with `Order` (`order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)`). Holds `partyName`, `partyAddress`, `partyDlNo`, `partyPhone`, `amount`, `totalDiscount`, `totalGst`, `grandTotal`.
  - `model Chemist` (lines 242–271):
    Currently has relations to `Order[]`, `Collection[]`, `Claim[]`, `Visit[]`, `EntityLedger[]`.
    *Observation*: `Chemist` currently has **no relation to `Doctor`**.
  - `model Doctor` (lines 163–211):
    Has relations to `Order[]`, `Visit[]`, `TourPlanDay[]`, `EntityLedger[]`, `DoctorCRMProfile?`, `PrescriptionHistory[]`.

- **Profit & Earned Income Reporting Views (Frontend & Backend)**:
  - `web/components/admin/admin-profit-intelligence.tsx`:
    - Component `AdminProfitIntelligence` displays:
      * Gross Invoiced Revenue (`totals.revenue`)
      * Total Purchase Cost (`totals.purchaseCost`)
      * Profit Earned (`totals.purchaseProfitAmount ?? totals.profitAmount`)
      * Net Profit Margin (`totals.purchaseProfitPct`)
      * Line-item breakdown table with revenue, cost, profit, and margin.
    - Backed by `GET /api/invoices`.
  - `web/app/(dashboard)/orders/page.tsx`:
    - Tab `"invoices"` (lines 528–790):
      * Displays table of invoices with columns: Invoice No, Chemist (Customer), Distributor, Amount, and for `role === "ADMIN"`: **"Profit Earned (₹)"** and **"Profit %"**.
      * Aggregate header card displays: Total profit (all matching invoices, not just this page), Revenue, and Avg Margin.
    - Tab `"orders"` (modal `NewOrderModal`, lines 890–1100):
      * Takes `chemistId`, `distributorId`, `items`.
      * Currently lacks `doctorId` selection field.
  - `web/app/api/invoices/route.ts`:
    - Uses `PROFIT_ITEM_SELECT` (lines 20–28) with `COST_BASIS_SELECT`.
    - Computes profit for each invoice via `computeProfit(items)` (lines 70–108).
    - Caches total profit aggregate across all matching records using `CacheService.getOrCompute` (lines 252–292) with a 20-second TTL.
  - `web/app/api/reports/route.ts` & `web/app/(dashboard)/reports/page.tsx`:
    - BI report engine supporting multiple reports (e.g. `product-wise-sales`, `molecule-sales-summary`, `chemist-360-report`, `doctor-dps-tiering`, `doctor-prescription-roi`).
    - In `molecule-sales-summary` (lines 160–257), `item.order.doctorId` is already tracked to compute `activeDoctorsPrescribing`.
  - `web/app/api/manager/ledgers/route.ts` & `web/app/(dashboard)/admin/financials/page.tsx`:
    - Displays `EntityLedger` transactions and aggregates (`salesRevenue`, `creditGiven`, `amountCollected`, `outstandingCredit`, `netRealizedProfit`) grouped per Doctor and Chemist.

---

### 1.2 Existing Test Suites, Test Runners, and Seed Scripts

- **Test Infrastructure (`web/package.json` & `web/jest.config.js`)**:
  - Test command: `cd web && npm test` or `npx jest --runInBand`.
  - Config: `web/jest.config.js` sets `testEnvironment: "jest-environment-node"`, `setupFiles: ["<rootDir>/jest.setup.api.js"]`, `testTimeout: 30000`, `maxWorkers: 1`.
  - Test DB Setup: `web/jest.setup.api.js` sets `DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/trend_mr_test?schema=public&connection_limit=3"`.
  - Shared test harness: `web/__tests__/helpers/api.ts` provides `testDb`, `resetFixture()` (which truncates test tables and seeds Admin, ASM, MR, Doctor, Chemist, Territory, Product), `tokenFor()`, `jsonRequest()`.

- **Verified Test Execution Results**:
  1. Pure Unit Tests:
     - Command: `cd web; npx jest __tests__/purchase-profit.test.ts __tests__/cost-basis.test.ts __tests__/gst.test.ts __tests__/scheme.test.ts`
     - Result: **PASS 4/4 suites, 47/47 tests passed (2.129s)**.
  2. Date Unit Tests:
     - Command: `cd web; npx jest __tests__/date.test.ts`
     - Result: **PASS 1/1 suite, 6/6 tests passed (2.075s)**.
  3. Static Contract Tests:
     - Command: `cd web; npx jest __tests__/contracts/pricing-consistency.test.ts`
     - Result: **PASS 1/1 suite, 4/4 tests passed (1.407s)**.
  4. Database Integration Tests:
     - Command: `cd web; npx jest __tests__/gst-invoice-integration.test.ts`
     - Result: **PASS 1/1 suite, 8/8 tests passed (14.357s)**. Tested database transactions, invoice creation, editing, deletion, and ledger entries against local PostgreSQL.
     - Command: `cd web; npx jest __tests__/enhanced-reporting.test.ts`
     - Result: **PASS 1/1 suite, 13/13 tests passed (3.175s)**.
     - Command: `cd web; npx jest __tests__/entities-crud-wiring.test.ts`
     - Result: **PASS 1/1 suite, 16/16 tests passed (4.350s)**.

- **QA Conformance Framework**:
  - `qa/specs/screens/*.yaml`: Authoritative screen specifications.
  - `qa/tools/extract-asbuilt.mjs`: Extracts AST route invariants into `qa/specs/as-built.json`.
  - `qa/tools/diff-spec.mjs`: Compares spec vs as-built.
  - Runner: `node qa/tools/qa-run.mjs`.

- **Database Seed Scripts**:
  - `web/prisma/seed.ts` (run via `cd web; npm run db:seed` or `npx tsx prisma/seed.ts`):
    - Seeds Admin (`admin@mrtracker.com`), MD (`md@mrtracker.com`), ASM (`asm@mrtracker.com`), MRs (`mr@mrtracker.com`, `abdulmannan@mrtracker.com`, `krishna@mrtracker.com`).
    - Seeds Products (Rabemeta-DSR, Metace-SP, Metaclav-CV, Metacef-200, Metacol-650).
    - Seeds Doctors (Dr. Shoaib, Dr. Fatima, Dr. Abdul Sayeed, etc.) and Chemists (Raza Medical Store, Orange Pharmacy, etc.).
    - Seeds Chart of Accounts (`DEFAULT_CHART_OF_ACCOUNTS`).

---

### 1.3 Concurrency & Asynchronous Processing Patterns in Codebase

1. **Node.js `worker_threads`**:
   - `web/services/workers/license-worker.js`: Worker thread executing regex parsing on license documents.
   - `web/services/license-parser.service.ts`: Spawns `new Worker(workerPath, { workerData })` with a 5000ms timeout guard, termination on completion/error, and automatic fallback to main-thread execution if worker spawning fails.
   - `web/scripts/multithreaded_fix_mr_invoice_logic.ts`: Parallel worker thread orchestration spawning 4 concurrent worker threads (`Worker(__filename, { workerData, execArgv: ["--import", loaderUrl] })`) with thread message/error handlers.
2. **Asynchronous Concurrent DB Execution (`Promise.all`)**:
   - Used heavily in API routes (e.g. `app/api/invoices/route.ts` line 200: `Promise.all([db.invoice.findMany(...), db.invoice.count(...)])`).
   - Prevents sequential roundtrips to PostgreSQL.
3. **In-Memory Analytical Caching (`CacheService`)**:
   - `web/services/cache.service.ts`: `CacheService.getOrCompute(key, fn, ttlSeconds)` prevents event-loop saturation on analytical aggregation endpoints.
4. **Scheduled Background Jobs (`node-cron`)**:
   - `web/jobs/daily-summary.ts`, `dps-scoring.ts`: Run scheduled asynchronous tasks without blocking web requests.

---

## 2. Logic Chain

1. **R1 (Chemist Master Profiles Doctor Assignment)**:
   - *Observation*: `schema.prisma` currently has no link between `Chemist` and `Doctor`. In `app/api/manager/entities/route.ts` and `app/api/manager/entities/[id]/route.ts`, Chemist payloads only handle scalar fields (name, address, creditLimit, licenseNo, dlCopyUrl, etc.).
   - *Reasoning*: To persist multiple doctors per chemist, a relation must be declared in Prisma. A direct many-to-many relation (`doctors Doctor[] @relation("ChemistToDoctors")` on `Chemist` and `chemists Chemist[] @relation("ChemistToDoctors")` on `Doctor`) allows Prisma to manage the join table cleanly without manual surrogate ID management.
   - *Consequence*: `GET /api/manager/entities` and `GET /api/manager/entities/[id]` must include `doctors: { select: { id: true, fullName: true, primarySpecialty: true } }`. `POST /api/manager/entities` and `PUT /api/manager/entities/[id]` must accept `doctorIds: string[]` and use Prisma's `doctors: { set: doctorIds.map(id => ({ id })) }`. In `web/app/(dashboard)/entities/page.tsx`, the Chemist edit/create modal must expose a multi-select component for linked doctors.

2. **R2 (Doctor Selection During Billing)**:
   - *Observation*: `Order` model in `schema.prisma` already has `doctorId String?` and `doctor Doctor?`. However, `CreateOrderSchema` in `web/lib/validators.ts` does not accept `doctorId`, `createOrder` in `web/app/api/orders/secondary/route.ts` does not save `doctorId`, and `NewOrderModal` in `web/app/(dashboard)/orders/page.tsx` has no doctor selection field.
   - *Reasoning*: When a user creates an order, `CreateOrderSchema` should accept `doctorId: z.string().uuid().optional()`. When a chemist is selected in `NewOrderModal`, the frontend should fetch the chemist's assigned doctors and display them at the top of the doctor dropdown (preferred/pre-filtered), while still providing access to the entire directory of doctors. The selected `doctorId` must be passed in the `POST` payload and stored in `tx.order.create({ data: { ..., doctorId } })`.

3. **R3 (Doctor Performance Tracking in Profit and Earned Income)**:
   - *Observation*: Profit calculation is governed by `web/lib/pricing.ts` (`profitFor` and `purchaseProfitFor`). Currently, `admin-profit-intelligence.tsx` displays aggregate revenue, purchase cost, and profit earned across invoices, and `orders/page.tsx` displays profit earned per invoice. `app/api/reports/route.ts` has reports for products and molecules, but no dedicated doctor-level profit contribution breakdown.
   - *Reasoning*: Because orders now store `doctorId`, billing records can be grouped by `order.doctorId`. For each doctor, the pipeline aggregates:
     - Prescriptions/Bills count: `count(distinct order.id)`
     - Total Sales Revenue: `sum(lineRevenue)`
     - Total Earned Income / Profit: `sum(lineProfit)`
     - Net Margin %: `(profit / revenue) * 100`
     - Prescribed products and top writing volume.
   - *Consequence*: Add a doctor contribution breakdown section in `components/admin/admin-profit-intelligence.tsx` and/or a dedicated report `doctor-profit-contribution` in `app/api/reports/route.ts` and `app/(dashboard)/reports/page.tsx`.

4. **R4 (Concurrent / Asynchronous Multi-threaded Processing)**:
   - *Observation*: `POST /api/orders/secondary` executes synchronous stock deduction and ledger posting in `db.$transaction`. Analytical queries in `app/api/invoices/route.ts` iterate through all invoice items synchronously. The codebase already has an established `worker_threads` pattern (`services/workers/license-worker.js` + `LicenseParserService`).
   - *Reasoning*:
     - Billing operations must remain transactional for database integrity (`tx.order.create`, `tx.invoice.create`, `tx.product.updateMany`, `postAutoLedger`), but auxiliary post-billing pipelines (cache invalidation, async prescriber analytics indexing, WhatsApp/email notifications) should run asynchronously in the background.
     - Analytical aggregations for doctor performance and profit calculations across large invoice datasets should execute via an asynchronous calculation service (`ProfitAnalyticsService` or `services/workers/profit-worker.js`) that uses chunked worker threads or `Promise.all` worker pools, paired with `CacheService` to prevent blocking the Next.js API server event loop.

---

## 3. Caveats

- **No Caveats on DB Availability**: PostgreSQL is verified running locally on port 5432, and test database `trend_mr_test` executed integration suites (`gst-invoice-integration.test.ts`, `enhanced-reporting.test.ts`, `entities-crud-wiring.test.ts`) with 100% pass rate.
- **Historical Orders Attribution**: In historical databases, past orders created before this change may have `order.doctorId === null`. The aggregation pipeline must gracefully handle unassigned orders (grouped under "Direct / Unassigned Prescriber") without throwing `null` pointer exceptions.
- **Worker Thread Execution in Next.js Serverless vs Node Server**: Worker threads (`node:worker_threads`) require a standard Node.js runtime environment (which `next start -p 5555` uses). The established fallback pattern (worker thread with inline fallback, as in `LicenseParserService`) should always be maintained for defensive fault tolerance.

---

## 4. Conclusion & Concrete Design Recommendations

### 4.1 Schema Migration (`web/prisma/schema.prisma`)
Add many-to-many relationship between `Chemist` and `Doctor`:
```prisma
model Doctor {
  ...
  chemists Chemist[] @relation("ChemistToDoctors")
}

model Chemist {
  ...
  doctors  Doctor[]  @relation("ChemistToDoctors")
}
```

### 4.2 Chemist Master Profile API (`web/app/api/manager/entities/route.ts` & `[id]/route.ts`)
1. In `CreateEntityBodySchema` and `UpdateEntityBodySchema`:
   ```ts
   doctorIds: z.array(z.string().uuid()).optional(),
   ```
2. In `GET /api/manager/entities` (type === "CHEMIST") and `GET /api/manager/entities/[id]`:
   Include `doctors: { select: { id: true, fullName: true, primarySpecialty: true } }`.
3. In `POST` and `PUT` handlers:
   If `doctorIds` is supplied:
   ```ts
   doctors: { set: doctorIds.map((id) => ({ id })) }
   ```

### 4.3 Billing Validation & Order Creation (`web/lib/validators.ts` & `web/app/api/orders/secondary/route.ts`)
1. In `CreateOrderSchema`:
   ```ts
   doctorId: z.string().uuid().optional().nullable(),
   ```
2. In `POST /api/orders/secondary`:
   Extract `doctorId` and pass to `tx.order.create`:
   ```ts
   data: {
     chemistId,
     doctorId: doctorId || null,
     distributorId,
     employeeId: bookingEmployee?.id ?? null,
     items: { create: orderItemsData },
   }
   ```
3. In `web/app/(dashboard)/orders/page.tsx` (`NewOrderModal`):
   - Add state: `const [doctorId, setDoctorId] = useState("")`.
   - When `chemistId` is selected, pre-filter doctor list: assigned doctors to this chemist appear in an "Assigned Doctors (Preferred)" optgroup at the top, followed by all doctors.
   - Pass `doctorId` in payload to `POST /api/orders/secondary`.

### 4.4 Doctor Contribution Analytics & Report
1. Create `doctor-profit-contribution` report in `web/app/api/reports/route.ts`:
   - Queries `db.orderItem.findMany` with `order: { doctorId: { not: null }, status: { not: OrderStatus.CANCELLED } }`.
   - Uses `profitFor([item])` from `web/lib/pricing.ts`.
   - Aggregates by doctor:
     * `doctorName`, `primarySpecialty`, `territoryName`
     * `prescriptionVolume` (distinct orders count)
     * `salesRevenue`
     * `cost`
     * `earnedIncome` (`profitAmount`)
     * `marginPercent`
   - Sorts descending by volume / revenue to identify top prescribers ("who is writing most").
2. Surface in UI:
   - Add Doctor Contribution Leaderboard in `web/components/admin/admin-profit-intelligence.tsx`.
   - Expose report in `web/app/(dashboard)/reports/page.tsx`.

### 4.5 Concurrency / Asynchronous Processing (R4)
1. **Asynchronous Aggregation Worker (`services/workers/profit-worker.js` / `services/profit-analytics.service.ts`)**:
   - Spawns worker thread to compute line-item profit sums in parallel chunks when aggregating large datasets.
   - Returns typed results: `{ revenue, cost, profitAmount, profitPct, doctorBreakdowns, processingTimeMs, isMultiThreaded }`.
   - Employs inline execution fallback if worker invocation fails.
2. **Asynchronous Cache Invalidation & Post-Processing**:
   - In `POST /api/orders/secondary`:
     Immediately after `db.$transaction` commits, dispatch asynchronous non-blocking cache invalidation:
     ```ts
     CacheService.invalidate("invoices_totals_");
     CacheService.invalidate("doctor_profit_");
     ```
     Execute post-commit background tasks via `setImmediate` or worker queue without delaying HTTP response.

---

## 5. Verification Method

### 5.1 Automated Unit & Contract Test Commands
Execute from `c:\Trend_MR\web`:
```powershell
# 1. Verify pricing consistency contract (zero rogue multipliers/fallback chains)
npx jest __tests__/contracts/pricing-consistency.test.ts

# 2. Verify pure unit calculation engines
npx jest __tests__/purchase-profit.test.ts __tests__/cost-basis.test.ts __tests__/gst.test.ts __tests__/scheme.test.ts

# 3. Verify date calculations
npx jest __tests__/date.test.ts
```

### 5.2 Database Integration Test Commands
Execute from `c:\Trend_MR\web`:
```powershell
# 1. Verify entities CRUD wiring (Doctors, Chemists, Distributors)
npx jest __tests__/entities-crud-wiring.test.ts

# 2. Verify order booking, invoice creation, and ledger integration
npx jest __tests__/gst-invoice-integration.test.ts

# 3. Verify enterprise reporting engine
npx jest __tests__/enhanced-reporting.test.ts
```

### 5.3 New Automated Tests to Add During Implementation
1. `__tests__/chemist-doctor-assignment.test.ts`:
   - Verifies assigning multiple doctors to a chemist profile via `POST` and `PUT /api/manager/entities`.
   - Verifies persistence and retrieval of linked doctors in chemist profile.
2. `__tests__/billing-doctor-selection.test.ts`:
   - Verifies `POST /api/orders/secondary` records and persists `doctorId` on the order and associated invoice.
   - Verifies pre-filtering logic returns chemist-assigned doctors first.
3. `__tests__/doctor-profit-concurrency.test.ts`:
   - Verifies `doctor-profit-contribution` calculation pipeline computes accurate sales revenue, earned income, and volume ranking.
   - Verifies concurrency/worker thread pipeline executes without blocking.

### 5.4 Invalidation Conditions
- Any change to `web/lib/pricing.ts` that alters `profitFor` or `costBasis` without running `pricing-consistency.test.ts`.
- Any invoice creation route that bypasses `db.$transaction` or mutates inventory outside the transaction.
- Any list endpoint modification that omits `pagination.total` or derives counts from `array.length`.
