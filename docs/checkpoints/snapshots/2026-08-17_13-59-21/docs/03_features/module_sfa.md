# Module: Sales Force Automation (SFA)

This document contains the functional specifications for the Sales Force Automation module.

---

## Core Workflows

### 1. Tour Planning (TP)
- **Goal**: Allow MRs to schedule visits for the upcoming month.
- **Workflow**:
  1. MR selects a target month and maps out daily planned territories and doctor/chemist visits.
  2. The draft plan is submitted.
  3. ASM (Area Sales Manager) reviews, comments, and either approves or rejects.
- **Rules**:
  - TP must be finalized and approved before the start of the target month.

### 2. Daily Call Reporting (DCR)
- **Goal**: Log field activities on a daily basis.
- **Workflow**:
  1. MR checks in at a doctor/chemist location.
  2. MR logs details of the meeting: products detailed, samples/gifts distributed, and chemist feedback.
  3. DCR is submitted, automatically syncing to the manager's dashboard.
- **Rules**:
  - DCR can only be submitted if attendance has been marked for that day.
  - Retrospective logging is capped at 48 hours unless unlocked by admin.

### 3. Geo Tracking & Check-In
- **Goal**: Validate actual field visits and prevent fraud.
- **Workflow**:
  1. Check-in records capture exact GPS coordinates (latitude, longitude, accuracy) and timestamp.
  2. Coordinates are verified against the registered Doctor/Chemist clinic coordinates (geofenced boundary, e.g., 100 meters).
  3. Alerts are triggered for out-of-boundary check-ins.

### 4. Order Booking & Collection Entry
- **Goal**: Enable direct order capturing from chemists during secondary sales visits.
- **Workflow**:
  1. MR selects a Chemist, inputs items, quantities, and selects a Distributor to fulfill the order.
  2. Outstanding payment amount is shown.
  3. MR records any payment collected (Cash, Cheque, Bank Transfer Reference).
