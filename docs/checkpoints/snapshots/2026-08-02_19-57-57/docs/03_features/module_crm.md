# Module: Chemist & Hospital CRM

This document details Chemist profiling (secondary sales) and Hospital targeting (institutional tenders).

---

## 1. Chemist CRM (Secondary Sales Interface)

### Chemist Master Profile
- **Licensing**: License Number, Registration Status, Business Classification (Retail or Wholesale).
- **Territory Alignment**: Mapped to doctor networks within territory lines to isolate visit trends.
- **Stock Audit Workflow**:
  1. MR checks in at the Chemist clinic.
  2. Records stock level per SKU (Product, Available Qty, Expiring Batch Qty).
  3. AI triggers a **Stock-out Alert** on the distributor portal if quantities fall below 3 days of historical sales.

### Secondary Sales Tracking
- Synthesized from MR order-booking entries and distributor sales uploads.
- Captures SKU-level units, unit prices, applied schemes, and returns.

---

## 2. Hospital CRM (Institutional Accounts)

### Hospital Master Profile
- **Key Accounts**: Links Bed Strength, Hospital Type (Govt, Private, Corporate), and specific clinical departments (Cardiology, Oncology, etc.).
- **Institutional Contacts**: Links Medical Superintendent, Head of Pharmacy, and Purchase Directors.

### Formulary & Tender Management
- **Formulary Status**: Tracks whether specific SKUs are approved for prescription within the hospital's internal pharmacy network.
- **Tender Tracking**: Logs bidding details, contract validity windows, approved rate structures, and payment terms (e.g. Net-60 days).
