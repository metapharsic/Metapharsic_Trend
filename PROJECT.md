# Project: Trend_MR Chemist Doctor Linking, Billing Selection & Profit Concurrency

## Architecture
- **Framework**: Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS
- **Database & ORM**: PostgreSQL, Prisma 5 (`web/prisma/schema.prisma`)
- **Core Domain & Business Logic**:
  - `web/lib/pricing.ts`: Single source of truth for cost basis (`costBasis`), invoice profit (`profitFor`), and purchase profit (`purchaseProfitFor`). Protected by pricing consistency static contracts.
  - `web/lib/validators.ts`: Zod request schemas.
  - `web/services/workers/`: Node.js `worker_threads` for CPU-intensive background tasks.
- **Data Flow**:
  1. Master Profiles (`/entities` & `/api/manager/entities`): Chemists and Doctors linked via `ChemistDoctor` junction relation.
  2. Billing Entry (`/orders` & `/api/orders/secondary`): Doctor selection dynamically loads assigned doctors first, allows system-wide selection, and persists `doctorId` on `Order` and `Invoice`.
  3. Doctor Analytics (`/reports` & `/api/reports`): Aggregates sales volume, profit, and prescription count by doctor using `pricing.ts`.
  4. Concurrency (`services/workers/doctor-profit-worker.js` & async pipelines): Non-blocking worker threads execute heavy aggregations without freezing the Next.js event loop.

## Code Layout & File Boundaries
- M1 Files:
  - `web/prisma/schema.prisma`
  - `web/lib/validators.ts` (entity schemas)
  - `web/app/api/manager/entities/route.ts`
  - `web/app/api/manager/entities/[id]/route.ts`
  - `web/app/(dashboard)/entities/page.tsx`
- M2 Files:
  - `web/lib/validators.ts` (`CreateOrderSchema`, `UpdateOrderItemsSchema`)
  - `web/app/api/orders/secondary/route.ts`
  - `web/app/api/orders/[id]/route.ts`
  - `web/app/api/invoices/route.ts`
  - `web/app/(dashboard)/orders/page.tsx`
- M3 Files:
  - `web/app/api/reports/route.ts`
  - `web/app/(dashboard)/reports/page.tsx`
  - `web/components/admin/admin-profit-intelligence.tsx`
  - `web/src/reports/reports.service.ts` (if applicable)
- M4 Files:
  - `web/services/workers/doctor-profit-worker.js`
  - `web/services/doctor-profit.service.ts`
  - `web/app/api/orders/secondary/route.ts` (async post-commit hooks)
  - `web/app/api/reports/route.ts` (worker dispatch)
- E2E Test Files:
  - `web/__tests__/chemist-doctor-assignment.test.ts`
  - `web/__tests__/billing-doctor-selection.test.ts`
  - `web/__tests__/doctor-profit-analytics.test.ts`
  - `web/__tests__/concurrency-performance.test.ts`
  - `web/__tests__/e2e-workflow.test.ts`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Chemist-Doctor Schema Association | Persist M:N relationship between Chemist and Doctor using `ChemistDoctor` junction table with referential integrity and indexes | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Chemist Profile Doctor Assignment API | Support receiving, persisting, updating, and retrieving assigned doctors for any chemist in `api/manager/entities` | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Chemist Profile Doctor Assignment UI | View assigned doctors in chemist dossier modal, assign/update doctors via multi-select tag picker in create/edit modals, badge in list | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Billing Doctor Validation Schema | Accept optional/nullable `doctorId` in `CreateOrderSchema` and `UpdateOrderItemsSchema` | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Billing Doctor Selection UI & Pre-filtering | Doctor picker in `NewOrderModal` pre-filtering and prioritizing chemist's assigned doctors while allowing search of full directory | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Billing Transaction Doctor Persistence | Record and persist selected `doctorId` on created `Order` and associated `Invoice` in `api/orders/secondary` | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Doctor Profit & Earned Income Calculation | Calculate total sales revenue, profit/earned income contribution via `pricing.ts`, and bill count grouped by doctor | M3 | ORIGINAL_REQUEST §R3 |
| 8 | Doctor Performance Ranking & Analytics UI | Interactive table and KPI cards in reports view displaying metrics per doctor with ranking to identify who writes the most | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Historical Doctor Attribution Resilience | Graceful handling and aggregation of historical orders where `doctorId` is null | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Asynchronous Multi-threaded Worker Pipeline | Worker thread (`node:worker_threads`) calculation pipeline for doctor profit analytics with inline fallback | M4 | ORIGINAL_REQUEST §R4 |
| 11 | Non-Blocking Post-Billing Processing | Asynchronous post-commit cache invalidation and notification hooks without blocking HTTP response | M4 | ORIGINAL_REQUEST §R4 |
| 12 | 100% E2E Verification & Adversarial Coverage | Pass 100% opaque-box E2E tests (Tiers 1-4) and adversarial gap audit (Tier 5) | M5 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Chemist Master Profiles Doctor Assignment | DB schema `ChemistDoctor`, API routes, and Master Profiles UI | none | IN_PROGRESS |
| M2 | Billing Doctor Selection with Pre-filtering | Validators, order creation API, and billing UI doctor selector | M1 | PLANNED |
| M3 | Doctor Performance Analytics & Reporting | Analytics calculations, report API, and reports UI | M2 | PLANNED |
| M4 | Concurrent Multi-threaded Processing | Node worker threads pipeline, async post-billing hooks, non-blocking APIs | M3 | PLANNED |
| M5 | Final Verification & Adversarial Hardening | Pass 100% E2E tests (Tiers 1-4) + Adversarial Coverage (Tier 5) | M1, M2, M3, M4, TEST_READY | PLANNED |

## Interface Contracts

### Chemist ↔ Doctor Interface
- **Model**: `ChemistDoctor`
  ```prisma
  model ChemistDoctor {
    id        String   @id @default(uuid())
    chemistId String
    chemist   Chemist  @relation(fields: [chemistId], references: [id], onDelete: Cascade)
    doctorId  String
    doctor    Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)
    createdAt DateTime @default(now())

    @@unique([chemistId, doctorId])
    @@index([chemistId])
    @@index([doctorId])
  }
  ```
- **API Payloads**:
  - `POST /api/manager/entities` (when `type: "CHEMIST"`):
    `{ ..., doctorIds?: string[] }`
  - `PUT /api/manager/entities/[id]`:
    `{ ..., doctorIds?: string[] }`
  - `GET /api/manager/entities/[id]?type=CHEMIST`:
    Returns `{ ...chemist, assignedDoctors: Array<{ id: string, fullName: string, primarySpecialty: string, clinicAddress: string }> }`

### Billing ↔ Doctor Interface
- **Validation**:
  - `CreateOrderSchema`: `doctorId: z.string().uuid().optional().nullable()`
- **Order Booking Payload**:
  - `POST /api/orders/secondary`: `{ chemistId: string, distributorId: string, doctorId?: string | null, items: [...] }`
- **Database Persistence**:
  - `Order.doctorId = doctorId`
  - `Invoice.doctorId = doctorId` (or accessible via `invoice.order.doctorId`)

### Doctor Analytics Interface
- **API**: `GET /api/reports?report=doctor-profit-contribution&from=&to=&territoryId=&minVolume=&sortBy=`
- **Response**:
  ```ts
  {
    success: boolean,
    data: Array<{
      doctorId: string,
      doctorName: string,
      specialty: string,
      territory: string,
      prescriptionsCount: number,
      totalUnits: number,
      salesRevenue: number,
      earnedIncome: number,
      profitMarginPct: number,
      rank: number
    }>,
    totals: {
      totalSalesRevenue: number,
      totalEarnedIncome: number,
      totalPrescriptions: number,
      totalUnits: number,
      overallMarginPct: number
    },
    performance: {
      processingTimeMs: number,
      isMultiThreaded: boolean,
      workerThreadId?: number
    }
  }
  ```

### Concurrency Worker Contract
- **Worker Script**: `web/services/workers/doctor-profit-worker.js`
- **Worker Input**: `{ ordersWithItems: Array<...>, basisLookup: Record<string, PricedProduct> }`
- **Worker Output**: `{ doctorBreakdowns: Array<...>, totals: { ... }, executionTimeMs: number }`
