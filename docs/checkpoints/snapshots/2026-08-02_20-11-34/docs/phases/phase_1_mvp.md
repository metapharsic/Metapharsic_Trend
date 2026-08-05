# Phase 1 Implementation Plan: Foundation & Authentication (MVP)

**Timeline**: Weeks 1-4

---

## 🎯 Target Objectives & Scope
Set up the core project layout, PostgreSQL database instance, role-based login interfaces, geofenced clinic check-ins, and biometric selfie validations.

---

## 📅 Week-by-Week Breakdown

### Week 1: Environment Scaffolding & DB Initialization
- **Backend**: Initialize the NestJS backend application (`npx create-nestjs-app`). Configure TypeORM/Prisma client connections.
- **Database**: Spin up PostgreSQL container. Validate schema compilation on `production_schema.prisma` models (`User`, `Employee`, `Territory`).
- **DevOps**: Setup GitHub actions pipelines linting codebase configurations automatically.

### Week 2: User Authentication & Device Binding
- **API**: Build `POST /api/auth/login` and token refreshes (`/api/auth/refresh`). Expose JWT payload containing `userId`, `email`, and `role`.
- **Security**: Implement hardware UUID check. If the device ID doesn't match the mapped token in the database, block the login.
- **Mobile**: Scaffold the Flutter client container. Set up basic landing page and local secure storage.

### Week 3: Biometric selfie match & Attendance check
- **Frontend (Mobile)**: Integrate Camera API on mobile. Implement selfie capture step.
- **Backend API**: Integrate face matching algorithm (mock face matches or AWS Rekognition) checking selfie against stored employee tokens.
- **Attendance Logging**: Log `Attendance` records (`checkIn`, `latitude`, `longitude`, `date`, `status: PRESENT`).

### Week 4: Geofenced DCR Logs & MVP Check
- **API**: Expose `/api/sfa/dcr/submit`.
- **Geofence Check**: Validate check-in coordinates against doctor clinic coordinates. Fail checks if distance exceeds `100 meters`.
- **QA Gate**: Ensure Jest integration tests cover coordinates mock verifications.
