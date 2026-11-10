# Dispatch: Project Orchestrator (Generation 2)

## 2026-11-01T07:58:17Z
Use a complete teamwork. In the Trend_MR web application, enable assigning multiple doctor (DR) names to chemist profiles in Master Profiles, provide doctor selection with assigned-doctor pre-filtering during billing, and add doctor-level performance analytics (identifying who writes the most) in Profit & Earned Income, wired using concurrency/asynchronous multi-threaded processing.

Working directory: c:\Trend_MR
Integrity mode: development

## Requirements

### R1. Chemist Master Profiles Doctor Assignment
In the Master Profiles module (web application), support assigning multiple doctor (DR) names to each chemist profile. Users must be able to view, link, and update assigned doctors for any chemist profile.

### R2. Doctor Selection During Billing
During invoice/billing entry in the web application, provide a doctor selection field. The selection must pre-filter and prioritize the doctors assigned to the selected chemist, while allowing the user to select or search for any other doctor in the system.

### R3. Doctor Performance Tracking in Profit and Earned Income
In the Profit and Earned Income reporting and analytics views, provide a doctor contribution breakdown showing who is writing the most. The view must display metrics per doctor including sales revenue, earned income/profit contribution, and prescription/billing volume, with ranking by highest volume.

### R4. Concurrent Multi-threaded Processing
Wire billing transaction processing and profit/earned income calculation pipelines using concurrency / background asynchronous processing so that billing operations and reporting aggregations execute efficiently without blocking the interface.

## Verification Resources
- Existing test suites and database seed scripts in the `Trend_MR` repository (`web/`).

## Acceptance Criteria

### Chemist Profile Management
- [ ] Chemist master profile interface allows assigning, viewing, and updating multiple doctor records associated with a chemist.
- [ ] Database schema persists the relationship between chemists and assigned doctors without data loss.

### Billing Doctor Selection
- [ ] When a chemist is selected on the billing screen, the doctor selection interface displays that chemist's assigned doctors as preferred/pre-filtered options.
- [ ] The user can choose a non-assigned doctor from the full doctor directory during billing.
- [ ] The selected doctor ID is recorded and stored on the resulting billing/invoice record.

### Profit & Earned Income Reporting
- [ ] Profit & Earned Income views display a breakdown by doctor indicating total sales, profit/earned income, and bill/prescription count.
- [ ] Doctors can be sorted or ranked by volume to clearly identify top prescribers ("who is writing much").
- [ ] Historical billing records attributed to doctors accurately reflect in the profit and earned income calculations.

### Concurrency & Automated Verification
- [ ] Billing transactions and report aggregate calculations execute asynchronously without blocking.
- [ ] Automated tests verify chemist doctor assignment, billing doctor selection, and doctor-wise profit calculation against the existing codebase.

---
Identity: Project Orchestrator (Generation 2)
Working directory: .agents/teamwork/orchestrator_gen2/
Original Request path: c:\Trend_MR\.agents\teamwork\ORIGINAL_REQUEST.md
Workspace root: c:\Trend_MR
