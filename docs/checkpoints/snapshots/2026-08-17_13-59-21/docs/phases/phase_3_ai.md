# Phase 3 Implementation Plan: AI Intelligence & Fraud Compliance

**Timeline**: Weeks 9-12

---

## 🎯 Target Objectives & Scope
Set up predictive intelligence tools (Doctor Potential Scoring, optimized visit route mapping), receipt OCR audit checks, and automated compliance alerts.

---

## 📅 Week-by-Week Breakdown

### Week 9: Doctor Potential Scoring (DPS) — ✅ Done
- **Calculations**: [web/lib/dps.ts](../../web/lib/dps.ts) + nightly job [web/jobs/dps-scoring.ts](../../web/jobs/dps-scoring.ts).
- **Formula discrepancy resolved**: this file originally specified 40/30/20/10 weights over four factors, while [kpi_formulas.md §6](../09_business_rules/kpi_formulas.md) specifies **0.30 footfall / 0.25 prescription / 0.20 influencer / 0.15 territory priority / 0.10 engagement** over five. The kpi_formulas version is implemented, since it is the canonical KPI library and its five factors match the tier bands in §7.
- **Normalization added**: raw inputs sit on incompatible scales (footfall ~35/day vs influencerLevel 1–5), so each factor is normalized to 0–100 before weighting — otherwise the 0–100 tier bands are unreachable. Ceilings are documented in `DPS_NORMALIZATION`.
- **Known proxy**: EngagementScore should be the running CQS average; CQS is not computed yet, so `DoctorCRMProfile.salesConversionRate` stands in.
- **Mapping**: `Doctor.dpsScore` / `dpsTier` / `requiredMonthlyVisits` persisted; tiers drive required visit frequency (A+ 12, A 8, B 4, C 2). API `/api/manager/doctors/dps` (GET scores + visit gap, POST recalculate). Web UI at `/doctors`.

### Week 10: AI Route Optimization & Map Sync — ◐ Partial
- **AI Logic**: [web/lib/route-optimizer.ts](../../web/lib/route-optimizer.ts) — nearest-neighbour heuristic over haversine distance. Deliberately **not** OR-Tools: for the 8–15 stops one MR covers daily the greedy tour is within ~10–25% of optimal, runs instantly, and adds no dependency. The function is the single swap-in point if exact routing is ever required.
- **Route API**: `/api/sfa/route-plan?date&latitude&longitude` returns the approved tour plan's stops in optimized sequence with per-leg and total distance.
- **Not done**: mobile map rendering and RxDB offline queue pipelines — mobile app work, out of scope for this backend pass.

### Week 11: Expense OCR Verification & Hashing — ◐ Partial
- **Fraud Checks**: ✅ Done in Phase 2 Week 8 — sha256 receipt hashing with duplicate rejection (409), verified live.
- **OCR Integration**: [web/lib/ocr.ts](../../web/lib/ocr.ts) defines the provider boundary and reports `configured: false` rather than inventing values. **No OCR credentials exist in this environment**; set `OCR_PROVIDER` + `OCR_API_KEY` and implement the provider branch to enable extraction. Fabricating a receipt date or amount would silently corrupt expense audits, so it deliberately fails loud instead.
- **Allowance Validation**: `validateReceiptDate()` implemented (future-dated and stale-receipt checks). Holiday-calendar cross-check still pending — no holiday calendar model exists yet.

### Week 12: Compliance Alerts & PharmaChat LLM — ◐ Partial
- **Security Alerts**: ✅ [web/jobs/compliance-alerts.ts](../../web/jobs/compliance-alerts.ts) scans `LocationLog.isMocked` every 15 min and locks offending accounts (`User.isActive=false` + `lockedAt`/`lockedReason`). `/api/manager/compliance` exposes status, on-demand scan, and admin unlock. **Verified live**: planted a spoofed log → account locked → MR login refused with "Account is inactive" → admin unlock → login restored.
- **PharmaChat**: [web/lib/pharmachat.ts](../../web/lib/pharmachat.ts) implements the MCP-style query tool layer — five typed, read-only tools (territory coverage, top doctors by potential, MR performance, uncovered doctors, sales summary), callable now via `POST /api/ai/pharmachat`. **Natural-language routing is not implemented**: no `ANTHROPIC_API_KEY` is configured, and keyword-guessing intent would give managers confidently wrong coverage answers. Set the key and wire the model to the existing tool layer to complete this.
- **QA Gate**: duplicate bill hash and GPS mock checks both verified live via API.
