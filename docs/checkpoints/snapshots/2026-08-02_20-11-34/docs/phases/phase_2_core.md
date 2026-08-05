# Phase 2 Implementation Plan: Core CRM & Distribution Setup

**Timeline**: Weeks 5-8

---

## 🎯 Target Objectives & Scope
Deliver master profiles (Doctor, Chemist, Distributor), Monthly Tour Plan calendar approvals, SKU-level product catalogs (MRP, PTR, PTS pricing), and secondary sales ordering.

---

## 📅 Week-by-Week Breakdown

### Week 5: Master Profiles & Territory Mapping
- **Database**: Populate `Doctor`, `Chemist`, and `Distributor` tables.
- **Backend APIs**: Expose CRUD paths for doctor clinic details, WhatsApp contact listings, and specialty category tags.
- **Frontend (Web)**: Build Admin Territory Management tree UI (NSM -> ZSM -> RM -> ASM -> MR assignment grid).

### Week 6: Product Catalog & e-Detailing Slides
- **Database**: Populate the `Product` table containingbase molecules composition, strength formats, and pack sizes.
- **Backend API**: Expose `/api/products/visual-aids` returning catalog listings.
- **Mobile**: Integrate PDF/Video viewer carousel for MR visual aid presentations. Add auto page-view duration logging.

### Week 7: Tour Plan (TP) Calendar Workflows
- **Workflows**: Expose `/api/sfa/tour-plan/submit`. MRs select planned doctors for each calendar day of the upcoming month.
- **Approvals**: Route TP to ASM dashboard. Expose `/api/sfa/tour-plan/approve` and `reject`.
- **Validation**: Enforce blocking checks preventing MR DCR check-ins if the doctor visited is not on the approved TP calendar day.

### Week 8: Order Booking & Basic Expense Claims
- **Ordering**: Expose `/api/orders/secondary`. MR bookings during Chemist visits auto-apply discount schemes and route order to the mapped Distributor.
- **Expense Logging**: Log daily mileage claims. Expose `/api/expenses/claims/upload`.
- **QA Gate**: Verify integration test suites mock order pricing multipliers and distance log km calculations.
