# Gap Analysis

Tracks differences between current MVP boundaries and Enterprise requirements.

---

## Current Gaps & Action Items

### 1. Offline Sync Conflict Resolution
- **Issue**: Multi-device order bookings or TP updates while offline.
- **Status**: Rule-based override (latest timestamp wins).
- **Target Solution**: Introduce CRDTs (Conflict-free Replicated Data Types) in database sync handlers for secondary orders.

### 2. ERP Database Sync Syncing Latencies
- **Issue**: Synced data (Invoices/Stock) from SAP/Oracle can lag by up to 24 hours.
- **Target Solution**: Convert static batch ETL routines into RabbitMQ event streaming queues.

### 3. FaceMatch Face Biometrics Timeout Gaps
- **Issue**: In low network field areas, face recognition APIs (AWS Rekognition) trigger timeouts.
- **Target Solution**: Fallback to encrypted offline local face feature hashes checked inside the Flutter container.

### 4. Expense Bill Duplicate Check Thresholds
- **Issue**: Slightly modified receipt images (e.g. contrast edits) can bypass MD5 hash comparisons.
- **Target Solution**: Deploy visual hash comparisons (pHash) in the Python OCR microservice.

### 5. Hospital Visit Coverage Not Trackable — ✅ RESOLVED
- **Was**: `Visit` had no `hospitalId`, so hospital coverage could not be measured.
- **Fixed**: `Visit.hospitalId` added with geofence validation against hospital coordinates in `/api/mr/visits`; the "Hospitals Covered" KPI now reports visited/total. Verified live: 0/1 → 1/1 after logging a hospital visit.

### 6. Discount Schemes Not Applied to Orders — ✅ RESOLVED
- **Was**: `/api/orders/secondary` priced every line at flat `Product.ptr`, ignoring `DiscountScheme`.
- **Fixed**: order creation now selects the best qualifying active scheme per line (`lib/scheme.ts` `bestSchemeFor`) and returns the applied schemes in the response. Verified live: 10 units → ₹120 (below the 50-unit threshold), 100 units → ₹114 (5% applied).

### 7. Call Quality Score Was a Proxy — ✅ RESOLVED
- **Was**: the DPS engagement factor used `DoctorCRMProfile.salesConversionRate` because CQS did not exist.
- **Fixed**: `lib/cqs.ts` implements CQS per kpi_formulas.md §1 (duration band, specialty-match detailing, tier-appropriate sample ROI). Scored at DCR submission onto `Visit.cqsScore`; the DPS job averages the doctor's last 10 scored visits, falling back to the old proxy only when no CQS exists. Verified live: a 6-minute on-specialty call scored CQS 100, moving the seeded doctor's DPS 29.5 → 39.5 and tier C → B.
- **Note**: CQS component weights are not specified in kpi_formulas.md; equal thirds are used and exported as `CQS_WEIGHTS` for tuning.

---

### 7a. Dependency Vulnerabilities — ◐ PARTIALLY RESOLVED
- **Was**: 13 advisories (2 critical, 9 high, 2 moderate).
- **Fixed**: now **5 high, 0 critical**. `next` 14.2.5 → 14.2.35 (patches the critical advisory), `bcrypt` 5 → 6 (drops the vulnerable `@mapbox/node-pre-gyp` → `tar` chain), `node-cron` 3 → 4 (drops vulnerable `uuid`), `sharp` → 0.35.
  - bcrypt is security-critical, so backward compatibility was verified explicitly: **existing bcrypt-5 password hashes still authenticate under bcrypt 6, and wrong passwords are still rejected** — confirmed against the live database without reseeding.
- **Remaining 5 highs all require Next.js ≥ 15.5**, i.e. a framework major upgrade. The 14.x branch is effectively end-of-life for security patches. Advisories include SSRF in Server Actions on custom servers, SSRF via WebSocket upgrades, and several DoS vectors in Server Components/Actions.
- **Mitigating context for this app**: no custom server, no Pages Router, no i18n, no `middleware.ts`, and no `next/image` usage — which excludes several of the listed advisories. The DoS vectors on Server Components/Actions are the material ones.
- **Decision required**: upgrading 14 → 15 changes route-handler `params` to a Promise, so every dynamic route needs updating. This is a deliberate migration, not a patch.

---

## External Services Not Configured

These are blocked on credentials, not implementation. Each has a real provider boundary in code that reports its unconfigured state rather than fabricating results.

### 8. Receipt OCR
- **Interface**: `web/lib/ocr.ts` — returns `configured: false` until `OCR_PROVIDER` + `OCR_API_KEY` are set.
- **Blocked**: OCR field extraction (vendor/date/amount) and the holiday-calendar date cross-check. Receipt *hashing* and duplicate detection work today and need no provider.

### 9. PharmaChat Natural-Language Queries
- **Interface**: `web/lib/pharmachat.ts` — five typed DB query tools are live and directly callable; only NL intent routing is blocked, on `ANTHROPIC_API_KEY`.
- **Deliberate non-implementation**: keyword-guessing intent without a model would return confidently wrong coverage numbers to managers making territory decisions.

### 10. Biometric Face Match
- **Blocked**: Phase 1 Week 3 selfie verification. Attendance check-in currently accepts a `faceToken` and stores it without verification — it is **not** a biometric gate today.
- **Target Solution**: AWS Rekognition (or equivalent) comparison against a stored employee face token, plus the offline local-hash fallback described in gap #3.
