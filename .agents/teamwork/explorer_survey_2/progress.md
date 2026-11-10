# Progress — Explorer Survey 2

Last visited: 2026-11-01T07:51:00Z

## Status
- [x] Initialized BRIEFING.md and progress.md
- [x] Discovered project structure and code layout (Next.js 14, React, Tailwind, Prisma, PostgreSQL, Jest)
- [x] Inspected Chemist and Doctor master profile schemas, models, API routes, and controllers
  - `web/prisma/schema.prisma` lines 163-240 (`Doctor`), lines 242-271 (`Chemist`)
  - `web/app/api/manager/entities/route.ts` (GET list, POST create)
  - `web/app/api/manager/entities/[id]/route.ts` (GET dossier, PUT update, DELETE)
  - `web/app/api/mr/entities/route.ts` (MR-scoped entity fetch)
- [x] Inspected Chemist and Doctor frontend components and views (create, edit, view, list)
  - `web/app/(dashboard)/entities/page.tsx` (`MasterProfiles`, `ViewDossierModal`, `AppendEntityModal`, `EditEntityModal`)
- [x] Inspected Billing schema, models, API routes, and controllers
  - `web/prisma/schema.prisma` lines 430-451 (`Order`), lines 857-892 (`Invoice`)
  - `web/lib/validators.ts` lines 138-161 (`CreateOrderSchema`), lines 167-181 (`UpdateOrderItemsSchema`)
  - `web/app/api/orders/secondary/route.ts` (POST createOrder, GET getOrders)
  - `web/app/api/orders/[id]/route.ts` (GET getOrder, PUT updateOrder)
  - `web/app/api/invoices/route.ts` (GET getInvoices)
  - `web/src/sales/sales.routes.ts`, `sales.service.ts`, `sales.schema.ts`
- [x] Inspected Billing frontend UI/components
  - `web/app/(dashboard)/orders/page.tsx` (`OrdersDashboard`, `NewOrderModal`, `EditOrderModal`)
  - `web/app/invoices/[id]/page.tsx` (Printable GST Invoice page)
- [x] Analyzed schema and design options for linking multiple doctors to chemists (M:N junction model `ChemistDoctor`)
- [x] Analyzed billing flow for chemist-assigned doctor pre-filtering and custom doctor selection
- [x] Synthesized findings into comprehensive handoff.md with 5 sections: Observation, Logic Chain, Caveats, Conclusion, Verification Method
- [x] Send handoff report to parent agent via send_message
