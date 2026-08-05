# Phase 3 Implementation Plan: AI Intelligence & Fraud Compliance

**Timeline**: Weeks 9-12

---

## 🎯 Target Objectives & Scope
Set up predictive intelligence tools (Doctor Potential Scoring, optimized visit route mapping), receipt OCR audit checks, and automated compliance alerts.

---

## 📅 Week-by-Week Breakdown

### Week 9: Doctor Potential Scoring (DPS)
- **Calculations**: Deploy background job calculating DPS based on patient daily footfall (`40%`), prescription average (`30%`), influencer rating (`20%`), and territory priority (`10%`).
- **Mapping**: Expose the calculated score to the doctor crm profiles. Auto-adjust doctor visit frequency requirements (e.g. A+ tier targets 12 visits/month).

### Week 10: AI Route Optimization & Map Sync
- **AI Logic**: Integrate route optimization APIs (Google OR-Tools or custom heuristic solver).
- **Mobile Sync**: Expose optimised daily route map sequencing to the MR mobile dashboard.
- **Offline Sync**: Implement RxDB queue pipelines on mobile, FIFO-uploading cached visits and orders when connectivity shifts.

### Week 11: Expense OCR Verification & Hashing
- **OCR Integration**: Configure Python OCR service (or AWS Textract integration).
- **Fraud Checks**: Generate unique cryptographic file hashes on receipt uploads. Flag claims as duplicates if hashes match existing claims.
- **Allowance Validation**: Auto-verify OCR parsed receipt date against HRMS holiday calendar logs.

### Week 12: Compliance Alerts & PharmaChat LLM
- **Security Alerts**: Flag mock location GPS signatures. Auto-lock user accounts on mock coords detection.
- **PharmaChat**: Build MCP database tooling connections. Expose conversational text interfaces enabling managers to query coverages using natural language.
- **QA Gate**: Run integration mock checks for duplicate bill hashes and GPS mocks.
