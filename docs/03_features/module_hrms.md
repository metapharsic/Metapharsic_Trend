# Module: HRMS, Payroll & Appraisals

This document details payroll structures, leave management, and employee performance appraisals.

---

## 1. Leave & Holiday Approvals
- **Balance Tracking**: Auto-adjusts Casual, Sick, and Planned leave allotments.
- **Workflow**:
  - `MR Submits Leave Request -> ASM Reviews -> Status Updates (APPROVED / REJECTED)`.
- **Calendar Sync**: Approved leaves automatically blank out dates on the MR's Tour Plan.

---

## 2. Payroll & Incentives
- **Salary Config**: Integrates basic monthly pay, tax deductions, PF, and ESIC.
- **Incentive Engine**:
  - Automatically queries the `Target` and actual secondary order `Invoice` completions.
  - Computes payouts based on achievement brackets (e.g., 100% target met triggers a 10% bonus multiplier).
- **Payslip Portal**: Generates monthly digital payslip files stored securely in S3/Blob storage.

---

## 3. Performance Scores
- Integrates DCR adherence, call averages, and compliance reports to assign a monthly performance grade used in yearly salary appraisals.
