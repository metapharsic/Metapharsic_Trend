# Testing Strategy

This strategy outlines automated and manual validation rules for Pharma OS core modules.

---

## 1. Automated Integration Tests

All backend services must pass integration test criteria before production deployment:

- **OCR receipt checks**: Mock OCR outputs containing:
  - Exact duplicates (matches `receiptHash` -> asserts `400 Bad Request`).
  - Dates matching weekend holidays (asserts policy warning flags).
- **Offline DB Sync checks**: Simulates database inserts using simulated latency lags (asserts conflict resolution rules run successfully).
- **Geofence Coordinate mocks**: Simulates visit coordinate pings:
  - Inside Geofence range (< 100m -> asserts visit allowed).
  - Outside Geofence range (>= 100m -> asserts geofence validation fails).
- **GPS Mock Spoofing**: Simulates coordinates provider containing mocked location signatures (asserts employee is locked out).

---

## 2. Automated End-to-End Tests (Selenium)

Pharma OS implements **Selenium WebDriver** browser automation checking UI/UX workflows:
- **Test environment**: Standalone chrome driver running locally on port `4444`.
- **Targets**:
  - Web Admin Dashboard login authentication.
  - Institutional Tender form inputs and validations.
  - Expense Auditing panels (verifying flags and rejection notes).

---

## 3. Coverage Requirements
- Minimum **80%** test coverage on all core controllers and database services.
- Mandatory schema validations (`prisma validate`) must occur before any migration creation.

