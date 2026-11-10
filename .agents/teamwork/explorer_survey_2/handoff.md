# Technical Investigation & Architecture Report: Master Profiles & Billing Modules

**Date**: 2026-11-01T07:50:00Z  
**Author**: Explorer Survey 2 (Domain & Feature Explorer: Master Profiles & Billing)  
**Target Modules**: Master Profiles (Chemist & Doctor Management, R1) & Billing Module (Invoice Entry & Doctor Selection, R2)  
**Status**: Completed  

---

## 1. Observation

### 1.1 Database Schema State (`web/prisma/schema.prisma`)
- **Doctor Model (`web/prisma/schema.prisma:163-211`)**:
  Contains primary demographic, medical, and territory fields:
  ```prisma
  model Doctor {
    id                         String                @id @default(uuid())
    userId                     String?               @unique
    user                       User?                 @relation(fields: [userId], references: [id])
    fullName                   String
    primarySpecialty           String
    secondarySpecialty         String?
    qualification              String?
    registrationNo             String?               @unique
    experienceYears            Int?
    practiceType               String?
    clinicAddress              String
    subArea                    String?
    beatName                   String?
    latitude                   Float
    longitude                  Float
    territoryId                String
    territory                  Territory             @relation(fields: [territoryId], references: [id])
    ...
    visits                     Visit[]
    orders                     Order[]
    tourPlanDays               TourPlanDay[]
    ledgers                    EntityLedger[]
    crmProfile                 DoctorCRMProfile?
    prescriptionHistories      PrescriptionHistory[]
    ...
  }
  ```
  *Direct Observation*: There is no relation or foreign key pointing to `Chemist`.

- **Chemist Model (`web/prisma/schema.prisma:242-271`)**:
  Contains store details, drug license attributes, and territory links:
  ```prisma
  model Chemist {
    id            String       @id @default(uuid())
    name          String
    contactPerson String
    address       String
    subArea       String?
    beatName      String?
    latitude      Float
    longitude     Float
    territoryId   String
    territory     Territory    @relation(fields: [territoryId], references: [id])
    licenseNo     String?
    dlCopyUrl     String?
    dlExpiryDate  DateTime?
    dlStatus      String?      @default("VERIFIED")
    type          String       @default("RETAIL")
    mobile        String?
    email         String?
    creditLimit   Decimal?     @db.Decimal(10, 2)
    billingName   String?
    gstNo         String?
    orders        Order[]
    collections   Collection[]
    claims        Claim[]
    visits        Visit[]
    ledgers       EntityLedger[]
    createdAt     DateTime     @default(now())
    updatedAt     DateTime     @updatedAt
  }
  ```
  *Direct Observation*: There is no relation or foreign key linking `Chemist` to `Doctor`.

- **Order Model (`web/prisma/schema.prisma:430-451`)**:
  Already defines both `chemistId` and `doctorId`:
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

    @@index([createdAt])
    @@index([employeeId, createdAt])
    @@index([status, createdAt])
  }
  ```
  *Direct Observation*: `Order` already has a nullable `doctorId` relation to `Doctor`. However, `doctorId` has no index in `Order`.

- **Invoice Model (`web/prisma/schema.prisma:857-892`)**:
  Has a 1-to-1 relation to `Order`:
  ```prisma
  model Invoice {
    id        String   @id @default(uuid())
    orderId   String   @unique
    order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
    invoiceNo String   @unique
    amount    Decimal  @db.Decimal(10, 2)
    paid      Boolean  @default(false)
    partyName      String?
    partyGstNo     String?
    partyAddress   String?
    partyDlNo      String?
    partyPhone     String?
    lrNo         String?
    lrDate       DateTime? @db.Date
    cases        Int?
    dueDate      DateTime? @db.Date
    transport    String?
    vehicleNo    String?
    totalItems   Int?
    totalQty     Int?
    totalDiscount Decimal? @db.Decimal(10, 2)
    totalGst     Decimal? @db.Decimal(10, 2)
    roundOff     Decimal  @default(0) @db.Decimal(10, 2)
    grandTotal   Decimal? @db.Decimal(10, 2)
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([createdAt])
    @@index([paid, createdAt])
    @@index([orderId])
  }
  ```
  *Direct Observation*: `Invoice` accesses `order.doctorId` via its `order` relation, but does not currently store a direct `doctorId` column.

---

### 1.2 Master Profiles UI & API (`web/app/(dashboard)/entities/page.tsx`, `web/app/api/manager/entities/`)
- **Page Component (`web/app/(dashboard)/entities/page.tsx:178-315`)**:
  The title at line 309 renders:
  `<h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Master Profiles</h1>`
  `TABS` at lines 142-148 includes `DOCTOR` ("Doctors") and `CHEMIST` ("Chemists").
- **Dossier View (`web/app/(dashboard)/entities/page.tsx:916-1290`, `ViewDossierModal`)**:
  - For Doctor (lines 1050-1084): renders specialty, registrationNo, DPS score & tier, recent visits, recent prescriptions.
  - For Chemist (lines 1086-1139): renders drug license (licenseNo), DL copy certificate, expiry date, contactPerson, billingName, GSTIN, creditLimit.
  - *Direct Observation*: There is no UI section for viewing doctors assigned to a chemist profile.
- **Chemist Creation (`web/app/(dashboard)/entities/page.tsx:1294-1898`, `AppendEntityModal`)**:
  - Lines 1379-1389: Chemist payload sends `contactPerson`, `billingName`, `gstNo`, `licenseNo`, `dlCopyUrl`, `creditLimit`, `whatsApp`.
  - *Direct Observation*: Does not allow selecting or assigning doctors during chemist creation.
- **Chemist Editing (`web/app/(dashboard)/entities/page.tsx:1902-2441`, `EditEntityModal`)**:
  - Lines 1986-1996 & 2159-2270: Chemist edit inputs include contact person, billing name, license number, GSTIN, credit limit, and DL copy.
  - *Direct Observation*: Does not allow viewing, adding, or removing assigned doctors for a chemist.
- **Backend Endpoints**:
  - `POST /api/manager/entities` (`web/app/api/manager/entities/route.ts:348-580`):
    - Validates against `CreateEntityBodySchema` (line 9). Schema does not declare `doctorIds`.
    - Handles Chemist creation at lines 562-580. Does not insert into any relation for doctors.
  - `GET /api/manager/entities` (`web/app/api/manager/entities/route.ts:56-346`):
    - Line 142: queries chemists using `db.chemist.findMany`. Does not include assigned doctors.
  - `GET /api/manager/entities/[id]` (`web/app/api/manager/entities/[id]/route.ts:42-277`):
    - Line 105: queries chemist dossier using `db.chemist.findUnique`. Does not include assigned doctors.
  - `PUT /api/manager/entities/[id]` (`web/app/api/manager/entities/[id]/route.ts:279-405`):
    - Validates against `UpdateEntityBodySchema` (line 7). Schema does not declare `doctorIds`.
    - Updates chemist at lines 363-405. Does not update any chemist-doctor linkage.

---

### 1.3 Billing Screen & Order Booking Pipeline (`web/app/(dashboard)/orders/page.tsx`, `web/app/api/orders/secondary/route.ts`)
- **Billing UI (`web/app/(dashboard)/orders/page.tsx`)**:
  - Header (lines 338-341): "My Sales" / "Orders Central" — "Book orders, generate invoices, track chemist balances".
  - Action "+ New Sale" (lines 344-350): launches `NewOrderModal`.
  - `NewOrderModal` (lines 890-1279):
    - Loads chemists via `GET /api/manager/entities?type=CHEMIST` (lines 904-921).
    - Loads distributors via `GET /api/manager/entities?type=DISTRIBUTOR` (lines 924-961).
    - Loads products via `GET /api/products?limit=100` (lines 963-966).
    - Chemist selection (lines 1040-1161): Uses a custom combobox with search filter (`chemistSearch`), displaying chemist name, address, beat, and phone.
    - Distributor selection (lines 1165-1180): Uses `SearchableSelect`.
    - Products selection (lines 1183-1260): Line items table allowing product selection, quantity, batch no, expiry date, free qty.
    - Submit handler `handleSubmit` (lines 980-1009):
      ```typescript
      await apiClient.post("/api/orders/secondary", {
        chemistId,
        distributorId,
        items: validItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          batchNo: it.batchNo || undefined,
          expDate: it.expDate || undefined,
          freeQty: it.freeQty || undefined,
        })),
      });
      ```
    - *Direct Observation*: `NewOrderModal` has NO doctor selection field, does not load doctors, and does not pass any `doctorId` in the request body.
  - `EditOrderModal` (lines 1281-1400):
    - Loads order via `GET /api/orders/${orderId}` and products via `GET /api/products`.
    - Submits status and items via `PUT /api/orders/${orderId}`.
    - *Direct Observation*: Has NO doctor selector or display.
  - Invoices Tab (lines 531-720):
    - Fetches invoices via `GET /api/invoices`. Displays Invoice No, Date, Chemist/Party, Revenue, Margin %, Paid status.
- **Validators (`web/lib/validators.ts`)**:
  - `CreateOrderSchema` (lines 138-161):
    ```typescript
    export const CreateOrderSchema = z.object({
      chemistId: z.string().uuid(),
      distributorId: z.string().uuid(),
      items: z.array(...).min(1),
      lrNo: z.string().optional(),
      lrDate: z.coerce.date().optional(),
      cases: z.number().int().min(0).optional(),
      dueDate: z.coerce.date().optional(),
      transport: z.string().optional(),
      vehicleNo: z.string().optional(),
    });
    ```
    *Direct Observation*: `doctorId` is completely missing from `CreateOrderSchema`.
  - `UpdateOrderItemsSchema` (lines 167-181): Also lacks `doctorId`.
- **Order Booking API Handler (`web/app/api/orders/secondary/route.ts:122-345`)**:
  - Unpacks payload: `const { chemistId, distributorId, items, lrNo, lrDate, cases, dueDate, transport, vehicleNo } = parsed.data;` (line 128).
  - Performs chemist credit exposure check (lines 203-223).
  - Inside `db.$transaction` (lines 240-277):
    - Creates order:
      ```typescript
      const createdOrder = await tx.order.create({
        data: {
          chemistId,
          distributorId,
          employeeId: bookingEmployee?.id ?? null,
          items: { create: orderItemsData },
        },
        include: { items: true },
      });
      ```
      *Direct Observation*: `doctorId` is omitted; `Order.doctorId` defaults to `null`.
    - Creates invoice:
      ```typescript
      const createdInvoice = await tx.invoice.create({
        data: {
          orderId: createdOrder.id,
          invoiceNo: `INV-${createdOrder.createdAt.getTime()}-${createdOrder.id.slice(0, 6).toUpperCase()}`,
          amount: newOrderValue,
          paid: false,
          partyName: chemist.billingName || chemist.name,
          ...
        },
      });
      ```
    - Deducts inventory movements (`ORDER_DEDUCTION`, line 295) and posts auto-ledger (line 307).
- **Secondary Sales Service (`web/src/sales/sales.service.ts:137-158`)**:
  - In contrast to `app/api/orders/secondary/route.ts`, `SalesService.createOrder` at line 142 already includes:
    `doctorId: data.doctorId ?? null,`
    and `web/src/sales/sales.schema.ts:21` has `doctorId: z.string().nullable().optional()`.
  - Furthermore, `web/services/commercial-agents.service.ts:226-233` already queries `order.doctor`, but had to implement a heuristic fallback (lines 361-387) because live billing orders booked via `NewOrderModal` never passed a `doctorId`.

---

## 2. Logic Chain

```
[Observation 1.1: Chemist and Doctor models have no association in schema.prisma]
                                     ↓
[Step 1: Clinical reality: Chemists dispense prescriptions written by multiple doctors in their beat/hospital/subArea; doctors write prescriptions filled by multiple retail chemists. This requires an M:N relationship.]
                                     ↓
[Step 2: Schema Design: An explicit junction model `ChemistDoctor` with @@unique([chemistId, doctorId]) and onDelete: Cascade ensures clean referential integrity, indexes on both foreign keys, and prevents duplicate doctor linkages.]
                                     ↓
[Observation 1.2: Master Profiles UI (web/app/(dashboard)/entities/page.tsx) and APIs lack doctor assignment fields]
                                     ↓
[Step 3: R1 Implementation:
 1. Update CreateEntityBodySchema and UpdateEntityBodySchema in manager/entities to accept optional `doctorIds: string[]`.
 2. In POST /api/manager/entities and PUT /api/manager/entities/[id], persist doctor assignments into `ChemistDoctor`.
 3. In GET /api/manager/entities/[id]?type=CHEMIST, include `assignedDoctors` with Doctor demographic details.
 4. Add dedicated endpoint `GET & PUT /api/chemists/[id]/doctors` for direct modular access.
 5. In Master Profiles UI:
    - ViewDossierModal: Add "Assigned Doctors (DR)" section displaying linked doctors.
    - AppendEntityModal: Add doctor multi-select tag picker for new chemists.
    - EditEntityModal: Add doctor multi-select tag picker to link/unlink doctors for existing chemists.
    - Main table: Add assigned doctor badges/counters.]
                                     ↓
[Observation 1.3: Billing form (NewOrderModal in orders/page.tsx) has only chemist and distributor pickers. Order booking API (orders/secondary/route.ts) and validator (CreateOrderSchema) lack doctorId]
                                     ↓
[Step 4: R2 Implementation:
 1. Add optional `doctorId: z.string().uuid().optional().nullable()` to `CreateOrderSchema` and `UpdateOrderItemsSchema` in `web/lib/validators.ts`.
 2. In `web/app/api/orders/secondary/route.ts`, accept `doctorId`, validate doctor exists, and store in `tx.order.create({ data: { doctorId, ... } })` and `tx.invoice.create({ data: { doctorId, ... } })`.
 3. In `web/prisma/schema.prisma`, add `doctorId String?` and `doctor Doctor?` to `model Invoice` and index `doctorId` on both `Order` and `Invoice`.
 4. In `NewOrderModal` (orders/page.tsx):
    - Load all active doctors on modal open.
    - When user selects `chemistId`, fetch that chemist's assigned doctors.
    - Render a Doctor Prescriber selector with:
      * PREFERRED GROUP / PILLS: Chemist-assigned doctors prominently shown at top ("⭐ Assigned to Chemist").
      * SEARCHABLE GROUP: All doctors in the directory, allowing selecting any non-assigned doctor.
    - Transmit `doctorId` in POST payload to `/api/orders/secondary`.
 5. In `EditOrderModal`: allow viewing and changing the linked doctor.
 6. In `GET /api/invoices`, include `order.doctor` in invoice rows and search filter.]
```

---

## 3. Caveats

1. **Prisma Client Regeneration**:
   Adding `ChemistDoctor` and `Invoice.doctorId` requires running `npx prisma db push --skip-generate` or `prisma generate` to update the generated `@prisma/client` types.
2. **Database Migration / Push**:
   Because SQLite or PostgreSQL might be running, adding a new model `ChemistDoctor` and nullable columns (`Invoice.doctorId`) is strictly additive (no destructive alterations or data loss on existing records).
3. **Existing Historical Orders**:
   Historical orders currently have `doctorId = null`. If downstream analytics (R3) query historical doctor performance, existing orders without doctors will aggregate under "General Practice / Direct" or unassigned prescriber, as already handled in `web/services/commercial-agents.service.ts:382-385`.
4. **Offline / Fallback Resilience**:
   In `NewOrderModal`, if the chemist has 0 assigned doctors, the doctor selector must smoothly present all doctors without disabling the field or showing errors.

---

## 4. Conclusion

Meeting requirements **R1** and **R2** requires coordinated changes across 3 layers:

### Layer A: Database Schema (`web/prisma/schema.prisma`)
1. Create model `ChemistDoctor`:
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
2. In `model Chemist`: Add `assignedDoctors ChemistDoctor[]`.
3. In `model Doctor`: Add `assignedChemists ChemistDoctor[]` and `invoices Invoice[]`.
4. In `model Invoice`: Add `doctorId String?`, `doctor Doctor? @relation(fields: [doctorId], references: [id])`, and `@@index([doctorId])`.
5. In `model Order`: Add `@@index([doctorId])`.

### Layer B: API Routes & Validators
1. **`web/lib/validators.ts`**:
   - `CreateOrderSchema`: add `doctorId: z.string().uuid().optional().nullable()`.
   - `UpdateOrderItemsSchema`: add `doctorId: z.string().uuid().optional().nullable()`.
2. **`web/app/api/manager/entities/route.ts`**:
   - `CreateEntityBodySchema`: add `doctorIds: z.array(z.string().uuid()).optional()`.
   - In `POST createEntity`: If `type === "CHEMIST"` and `doctorIds?.length`, insert into `tx.chemistDoctor.createMany`.
3. **`web/app/api/manager/entities/[id]/route.ts`**:
   - `UpdateEntityBodySchema`: add `doctorIds: z.array(z.string().uuid()).optional()`.
   - In `GET getEntityDetails`: If `type === "CHEMIST"`, include `assignedDoctors: { include: { doctor: true } }`.
   - In `PUT updateEntity`: If `type === "CHEMIST"` and `doctorIds !== undefined`, delete existing `chemistDoctor` records and insert new ones.
4. **`web/app/api/chemists/[id]/doctors/route.ts` (New Endpoint)**:
   - `GET`: Returns `{ assignedDoctors: Doctor[], total: number }` for the given chemist ID.
   - `PUT`: Atomically updates the chemist's doctor associations.
5. **`web/app/api/orders/secondary/route.ts`**:
   - Accept `doctorId` in `createOrder`.
   - Pass `doctorId` into `tx.order.create` and `tx.invoice.create`.
6. **`web/app/api/orders/[id]/route.ts`**:
   - Support updating `doctorId` on open orders.
7. **`web/app/api/invoices/route.ts`**:
   - Include `doctor: { select: { id: true, fullName: true, primarySpecialty: true } }` in `include.order.select`.
   - Support filtering invoices by doctor name in `q` and `customer` query params.

### Layer C: Frontend Views & Components
1. **`web/app/(dashboard)/entities/page.tsx` (Master Profiles)**:
   - `ViewDossierModal`: Add "Assigned Doctors (DR)" section displaying list of doctors (with specialty and clinic badge) associated with the chemist.
   - `AppendEntityModal`: Add multi-select searchable doctor selector with chips/tags.
   - `EditEntityModal`: Add multi-select searchable doctor selector to link/unlink doctors.
   - Main Chemists list: Add doctor count pill (e.g. `👨‍⚕️ 3 Doctors Linked`).
2. **`web/app/(dashboard)/orders/page.tsx` (Billing Screen)**:
   - `NewOrderModal`:
     - Load all doctors on mount via `/api/manager/entities?type=DOCTOR&limit=300`.
     - When `chemistId` is chosen, fetch assigned doctors from `/api/chemists/${chemistId}/doctors`.
     - Render Doctor Selection field with:
       * Pre-filtered Assigned Doctors section at the top with quick-select clickable pills.
       * Full searchable doctor directory dropdown below allowing selection of any other doctor.
     - Send `doctorId` in payload to `/api/orders/secondary`.
   - `EditOrderModal`: Render doctor selector to view and reassign doctor on existing orders.
   - Generated Invoices table: Add Doctor column showing prescribing doctor next to Chemist name.

---

## 5. Verification Method

### 5.1 Automated Unit & Integration Tests
Run via Jest in `web/`:
```bash
cd c:\Trend_MR\web
npm test -- __tests__/entities-crud-wiring.test.ts
npm test -- __tests__/gst-invoice-integration.test.ts
```

1. **Chemist Doctor Assignment Tests (`__tests__/entities-crud-wiring.test.ts`)**:
   - Create Chemist with `doctorIds: [fx.doctorId]`. Verify HTTP 201 and database record in `ChemistDoctor`.
   - Call `GET /api/manager/entities/${chemistId}?type=CHEMIST`. Verify `assignedDoctors` array contains the linked doctor.
   - Call `PUT /api/manager/entities/${chemistId}` with updated `doctorIds`. Verify database sync and cascade behavior.
2. **Billing Doctor Selection Tests (`__tests__/gst-invoice-integration.test.ts`)**:
   - Book secondary order with `chemistId: fx.chemistId`, `distributorId: fx.distributorId`, `doctorId: fx.doctorId`.
   - Verify `Order.doctorId === fx.doctorId` in PostgreSQL.
   - Verify `Invoice.doctorId === fx.doctorId` in PostgreSQL.
   - Book secondary order without `doctorId` (optional check). Verify order succeeds with `doctorId === null`.
3. **Invariants & Contracts (`__tests__/contracts/api-invariants.test.ts`)**:
   - Ensure `/api/orders/secondary` and `/api/invoices` contracts remain satisfied.

### 5.2 Manual UI Verification
1. Navigate to `http://localhost:5555/entities` -> Switch to **Chemists** tab.
2. Click **+ Add New Chemist** -> Select 2 doctors in the "Assigned Doctors" field -> Save -> View Chemist dossier -> Confirm both doctors appear in "Assigned Doctors (DR)".
3. Click **Edit Chemist** -> Remove 1 doctor, add another -> Save -> Confirm updated links.
4. Navigate to `http://localhost:5555/orders` -> Click **+ New Sale**.
5. Select the chemist -> Verify that the doctor selector immediately highlights the chemist's assigned doctors at the top as preferred options.
6. Type the name of a non-assigned doctor in the doctor search box -> Verify the system allows selecting the non-assigned doctor.
7. Enter items and click **Book Order** -> Confirm order is created and invoice displays the selected doctor's name.

### 5.3 Invalidation Conditions
- Any change that makes `doctorId` mandatory rather than optional in `CreateOrderSchema`, breaking existing orders or automated tests.
- Storing chemist-doctor linkages in an unindexed JSON column rather than a normalized relational junction table, violating relational consistency and indexing.
- Creating an implicit relation without `onDelete: Cascade`, leaving orphaned records upon entity deletion.
