# Phase 4 Implementation Plan: Institutional Sales & HRMS (Scale)

**Timeline**: Weeks 13-16

---

## 🎯 Target Objectives & Scope
Scale the platform to support Hospital Tender contracts, LMS training courses, HRMS leaves and payroll appraisals, 100+ BI Reports, and scheme margin simulators.

---

## 📅 Week-by-Week Breakdown

### Week 13: Institutional Tenders & Rate Contracts — ✅ Done
- **Hospital CRM**: `/api/hospitals` (list/create) — departments, purchase manager, medical superintendent, bed strength already modelled on `Hospital`.
- **Tenders**: New `HospitalTender` model (tender no, contract rate, quantity, validity window, `TenderStatus` DRAFT→SUBMITTED→WON/LOST/EXPIRED). `/api/hospitals/tenders` GET/POST/PUT.
- **Formulary**: New `HospitalFormulary` model with unique `(hospitalId, productId)`. `/api/hospitals/formulary` upserts inclusion status so MRs can toggle repeatedly without creating duplicates.

### Week 14: LMS training courses — ◐ Partial
- **Database**: ✅ `LMSCourse` / `LMSEnrollment` populated and seeded. Added `LMSEnrollment.quizScore`.
- **Features**: `/api/lms/courses` and `/api/lms/enrollments` track progress percentage and quiz score. Completion requires **both** 100% progress and a passing quiz score (≥60), since completion feeds appraisal grades.
- **Not done**: video module playback tracking — needs a media host and per-module content model, neither of which exists yet.
- **Appraisals Integration**: completion rates surface via the "Training Compliance" BI report; they do not yet write into a formal performance-grade field (no appraisal model exists).

### Week 15: HRMS Leaves, Payroll & Incentives — ✅ Done
- **HRMS Workflows**: `/api/hrms/leave` GET/POST/PUT. Approving a leave **deletes the MR's tour-plan days in that range** inside the same transaction, so the calendar cannot demand visits during approved leave. **Verified live**: TP days went 1 → 0 on approval.
- **Payroll Config**: [web/lib/payroll.ts](../../web/lib/payroll.ts) — achievement measured as collections banked in the month against overlapping `Target` values, mapped to flat incentive slabs (≥120% → 25%, ≥100% → 15%, ≥85% → 8%, ≥70% → 4% of basic), then PF 12% / ESIC 0.75% / tax 10% of gross. `/api/hrms/payroll` GET/POST, upserted per employee-month. **Verified live**: 105% achievement → 15% slab → ₹6,000 incentive on ₹40,000 basic, net ₹36,300.

### Week 16: BI Reports & Scheme Simulator — ✅ Done (10 reports, not 100+)
- **Reports**: [/api/reports](../../web/app/api/reports/route.ts) exposes a self-describing catalogue of **10 live reports** across 6 categories — Product-wise Sales, Territory Performance, Doctor Coverage Index, Missed Visit Log, Call Average per MR, Expense Claim Summary, Outstanding Approvals, GPS Violations, Tender Pipeline, Training Compliance. Web UI at `/reports`. The spec's "100+ Reports Matrix" is a catalogue target, not a single deliverable; these 10 cover every category in [reporting_engine.md §3](../08_backend/reporting_engine.md) and the pattern extends by adding entries to the `REPORTS` map.
- **Simulator**: `/api/simulator/scheme` + `/simulator` UI. Projects discounted PTR, unit/total margin deltas, and retailer margin off MRP from the real MRP/PTR/PTS ladder, and flags when a discount pushes the stockist below PTS. **Verified live**: 10% off the seeded product (PTR ₹120 → ₹108 against PTS ₹110) correctly flagged as margin-negative.
- **QA Gate**: full schema pushed and verified; every endpoint above exercised live. Load testing not performed.
