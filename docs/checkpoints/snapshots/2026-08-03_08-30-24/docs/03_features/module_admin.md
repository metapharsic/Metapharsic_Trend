# Module: Admin Governance

The Admin module handles platform configuration, security gates, and territory management.

---

## 1. User & Identity Governance
- **MFA Configuration**: Admin configures multi-factor authentication requirements for specific roles (e.g. Finance, MD, Admin).
- **Device Bindings**: Enforces hardware UUID binding locks. Admin dashboard features a **Reset Device Token** tool to authorize new devices for MRs.

---

## 2. Territory Hierarchy
- Defines multi-tiered geological lines:
  `Country -> Zone -> Region -> Area -> Territory -> HQ`.
- Admin panel manages re-assignments (moving an MR from Territory A to B and auto-mapping their clinics).

---

## 3. Global Rule Engine Configurations
- **Visit Rules**: Configures visit limits and retrospect log limits (DCR log limit, e.g. 24 hours).
- **Expense Policies**: Maps daily allowance tiers per category and role.
- **Geofence Parameters**: Establishes check-in allowed radius (e.g. 100 meters) and accuracy limits.

---

## 4. Admin Dashboard KPIs

`GET /api/manager/dashboard/admin-kpis` (ADMIN role only) powers the `/admin` panel. Implemented at [web/app/api/manager/dashboard/admin-kpis/route.ts](../../web/app/api/manager/dashboard/admin-kpis/route.ts).

| KPI | Source | Window |
|---|---|---|
| Total Employees | `Employee` count | All-time |
| Active MRs | `Employee` where role=MR, isActive=true | Current |
| Today's Attendance | `Attendance` status=PRESENT | Today |
| Live Location | Distinct `LocationLog.employeeId` | Last 15 min |
| Doctors Covered | Distinct `Visit.doctorId` vs total `Doctor` | This month |
| Chemists Covered | Distinct `Visit.chemistId` vs total `Chemist` | This month |
| Hospitals Covered | Total `Hospital` count | All-time — **no actual coverage %,** `Visit` has no `hospitalId` relation yet (see gap analysis) |
| Orders | `Order` count | This month |
| Sales | `OrderItem.price * quantity` sum | This month |
| Collections | `Collection.amount` sum | This month |
| Pending Approvals | `TourPlan` PENDING_ASM + `Expense` PENDING_* + `Claim` PENDING_* | Current |
| Top / Low Performers | Employees ranked by `Visit` count | This month |
| Expenses | `Expense.amount` sum | This month |
| Leave Requests | `LeaveRequest` status=PENDING | Current |
| GPS Violations | `Visit.anomalyFlag` + `LocationLog.isMocked` | This month |
| Missed Calls | Approved `TourPlanDay` with `plannedDoctorId` and no matching `Visit` same employee/doctor/day | This month, past days only |
| New Doctors Added | `Doctor.createdAt` | This month |
| Stock Status | `Product.stockQty` below threshold (50 units) | Current |
