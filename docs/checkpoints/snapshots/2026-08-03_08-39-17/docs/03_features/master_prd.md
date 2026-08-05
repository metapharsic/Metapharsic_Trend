# Product Requirement Document (PRD)

**Project Name**: Pharma OS  
**Status**: Draft  
**Version**: 1.1.0  

---

## 1. Executive Summary
Pharma OS is an enterprise-grade field force automation and business intelligence platform designed to replace fragmented pharma tools. It unites DCR reporting, doctor CRM profiling, geo-fenced HR compliance, automated claims, and AI forecasting into a single, high-reliability platform.

---

## 2. Core Functional Requirements

### FR-01: Offline-First Field Work (SFA)
- **Description**: MRs must be able to log Tour Plans, Daily Call Reports (DCR), and orders without an active internet connection.
- **Rules**:
  - The Flutter application stores local transactions in an encrypted local database (e.g. Hive or RxDB).
  - Sync automatically triggers back to NestJS endpoints when an internet connection is detected.
  - Conflict resolution is rule-based: the latest mobile device timestamp overrides conflicting database entries.

### FR-02: Doctor Intelligence Index (CRM)
- **Description**: AI Service analyzes visit histories, prescription patterns, and competitors to generate a prioritized engagement score (1-100) per doctor.
- **Rules**:
  - High intelligence score doctors are auto-populated in MR Route plans.

### FR-03: Fraud Protection Guard (HRMS/Expenses)
- **Description**: Automatically flag fraudulent activity in check-ins and travel claims.
- **Rules**:
  - Location mock flags on mobile must result in immediate check-in locking and notify the admin.
  - Duplicate receipts processed by the OCR engine must automatically lock the expense claim with status `REJECTED`.

### FR-04: Chemist & Hospital Targeting
- **Description**: MRs log stock availability and secondary sales during chemist visits.
- **Rules**:
  - Low stock logs automatically trigger notifications to mapped distributors.
  - Hospital entries track tender validity and rate contracts.

### FR-05: Product Visual Aids (e-Detailing)
- **Description**: Mobile app acts as an interactive visual aid presenter.
- **Rules**:
  - Presenter tracks time spent on each slide and uploads engagement analytics to the BI engine.

### FR-06: Sample & Gift Quotas
- **Description**: Controls sample distributions to doctors.
- **Rules**:
  - Enforces a maximum sample limit (e.g., max 5 units/month) per doctor, auto-decrementing from the rep's `SampleInventory`.

### FR-07: Leave & Payroll Workflow
- **Description**: Automated payslip generation and leave requests.
- **Rules**:
  - Approved leaves automatically freeze dates on the Tour Plan calendar.
  - Incentive logic queries sales target ratios to calculate bonus payroll figures.

### FR-08: Admin Governance Layer
- **Description**: Exposes system-wide rule configurations, MFA switches, and territory tree mappings.
- **Rules**:
  - Requires Admin authentication to reset device tokens.

### FR-09: Enterprise BI Reporting
- **Description**: Consolidates sales, activity, financial, and compliance metrics into structured dashboard sheets.

### FR-10: Predictive Analytics Dashboard
- **Description**: AI service generates 3-month sales demand forecasts and flags doctor brand switch risks.

