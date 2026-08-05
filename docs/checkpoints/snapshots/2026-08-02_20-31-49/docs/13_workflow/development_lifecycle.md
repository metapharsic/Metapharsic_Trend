# Development Lifecycle & Gateways

This document details the standard developer workflow when building features on Pharma OS.

---

## The Feature Lifecycle

### Step 1: Feature Spec Review
- Before writing code, locate the module spec in `/docs/03_features/` and the database requirements in `/docs/02_database/schema_design.md`.

### Step 2: Database Schema & Migration
- Add new models or fields to `docs/02_database/production_schema.prisma`.
- Run validation checks:
  ```powershell
  npx prisma validate --schema=docs/02_database/production_schema.prisma
  ```
- Generate and run the migration against local PG staging database:
  ```powershell
  npx prisma migrate dev --name <migration_name>
  ```

### Step 3: Backend Implementation
- Scaffold the NestJS Module, Service, and Controller.
- Implement business validations as documented in `docs/09_business_rules/core_logic.md`.

### Step 4: Frontend Development
- Extend mobile RxDB models or Next.js state slices.
- Build UI views conforming to `docs/07_frontend/ui_guidelines.md`.

### Step 5: Test Verification
- Write Jest integration tests ensuring all success and fail validation paths are tested.
- Ensure coverage satisfies the limits mapped in `docs/11_testing/strategy.md`.
