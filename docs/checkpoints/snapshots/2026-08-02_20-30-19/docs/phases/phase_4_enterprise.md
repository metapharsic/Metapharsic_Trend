# Phase 4 Implementation Plan: Institutional Sales & HRMS (Scale)

**Timeline**: Weeks 13-16

---

## 🎯 Target Objectives & Scope
Scale the platform to support Hospital Tender contracts, LMS training courses, HRMS leaves and payroll appraisals, 100+ BI Reports, and scheme margin simulators.

---

## 📅 Week-by-Week Breakdown

### Week 13: Institutional Tenders & Rate Contracts
- **Hospital CRM**: Build clinical department master profiles and key contacts directories.
- **Tenders**: Expose Hospital Tenders rate contract lists.
- **Formulary**: Build hospital formulary inclusion status checklist logs for MRs.

### Week 14: LMS training courses
- **Database**: Populate `LMSCourse` and `LMSEnrollment` tables.
- **Features**: Implement video module playback trackers, quiz checklists, and score calculation engines.
- **Appraisals Integration**: Map employee course completion percentages into their performance grades.

### Week 15: HRMS Leaves, Payroll & Incentives
- **HRMS Workflows**: Implement leave approval requests. Approved leaves automatically freeze dates on the MR's calendar.
- **Payroll Config**: Build the incentive calculation engine. Query `Target` sales and actual payments collected to calculate bonus net salary.

### Week 16: BI Reports & Scheme Simulator
- **Reports**: Build the 100+ Reports Matrix panels (Sales Growth, Missed DCRs, Outstanding accounts aging, and Compliance audits).
- **Simulator**: Build the Web Scheme Margin Simulator, allowing leadership to adjust stockist discount parameters and project net margin outcomes.
- **QA Gate**: Validate full production prisma schemas and perform system load testing.
