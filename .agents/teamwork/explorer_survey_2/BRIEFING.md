# BRIEFING — 2026-11-01T07:48:00Z

## Mission
Investigate Master Profiles (Chemist & Doctor) and Billing modules for multi-doctor assignment (R1) and doctor selection in billing (R2).

## 🔒 My Identity
- Archetype: explorer
- Roles: Domain & Feature Explorer (Profiles & Billing)
- Working directory: c:\Trend_MR\.agents\teamwork\explorer_survey_2
- Original parent: f6ef167a-1c90-46cc-bd90-6f5c22824b66
- Milestone: Investigation & Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Focus on Master Profiles (Chemist and Doctor creation, editing, viewing, relations) and Billing module (Invoice entry, chemist selection, item selection, doctor selection if any, API endpoints, frontend views/forms)
- Concrete file paths, component names, API endpoints, schema, and proposed changes for R1 and R2
- Produce comprehensive handoff.md with 5-component structure

## Current Parent
- Conversation ID: f6ef167a-1c90-46cc-bd90-6f5c22824b66
- Updated: 2026-11-01T07:48:00Z

## Investigation State
- **Explored paths**:
  - `web/prisma/schema.prisma` (Chemist, Doctor, Order, Invoice)
  - `web/app/(dashboard)/entities/page.tsx` (Master Profiles UI, View/Create/Edit modals)
  - `web/app/api/manager/entities/route.ts` & `[id]/route.ts` (Entity CRUD APIs)
  - `web/app/api/mr/entities/route.ts` (MR entity directory API)
  - `web/app/(dashboard)/orders/page.tsx` (Billing / Orders dashboard, NewOrderModal, EditOrderModal)
  - `web/app/api/orders/secondary/route.ts` & `[id]/route.ts` (Order booking & invoice creation APIs)
  - `web/app/api/invoices/route.ts` & `web/app/invoices/[id]/page.tsx` (Invoice listing and invoice printing)
  - `web/src/sales/sales.routes.ts`, `sales.service.ts`, `sales.schema.ts` (Secondary sales engine)
  - `web/lib/validators.ts` (Zod schemas for orders and entities)
  - `web/services/commercial-agents.service.ts` (Invoice aggregation and doctor-level sales linking)
  - `web/__tests__/entities-crud-wiring.test.ts` & `gst-invoice-integration.test.ts` (Test suites)
- **Key findings**:
  - `Chemist` and `Doctor` currently have no direct database relation in `schema.prisma`.
  - An explicit M:N junction model `ChemistDoctor` with `@@unique([chemistId, doctorId])` and cascade deletes will cleanly model the relationship.
  - Billing entry is in `web/app/(dashboard)/orders/page.tsx` within `NewOrderModal`, posting to `POST /api/orders/secondary`.
  - `Order` model in Prisma already has `doctorId String?` and `doctor Doctor?`, but `CreateOrderSchema` in `validators.ts` and `POST /api/orders/secondary` omitted `doctorId`.
  - Adding `doctorId` to `NewOrderModal` with pre-filtered chemist-assigned doctors and fallback to full doctor directory satisfies R2.
- **Unexplored areas**: None for R1 and R2 scope.

## Key Decisions Made
- Recommend explicit junction model `ChemistDoctor` over implicit many-to-many for clarity, cascade deletion, and auditability.
- Add `doctorId String?` to `model Invoice` in addition to existing `Order.doctorId` to guarantee direct invoice-level doctor persistence.
- Design dedicated `GET /api/chemists/[id]/doctors` endpoint alongside integrating `doctorIds` into `/api/manager/entities` for clean frontend consumption.

## Artifact Index
- DISPATCH.md — Dispatch instructions
- BRIEFING.md — Working memory and context
- progress.md — Liveness heartbeat and task progress
- handoff.md — Comprehensive investigation report with 5 components
