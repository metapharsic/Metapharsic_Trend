# Phase 1 Implementation Plan: Foundation & Authentication (MVP)

**Timeline**: Weeks 1-4

---

## 🎯 Target Objectives & Scope
Set up the core project layout, PostgreSQL database instance, role-based login interfaces, geofenced clinic check-ins, and biometric selfie validations.

---

## 📅 Week-by-Week Breakdown

### Week 1: Environment Scaffolding & DB Initialization — ✅ Done (superseded stack)
- **Backend**: ~~Initialize the NestJS backend application~~ Built as **Next.js 14 App Router** instead (`web/app/api`), Prisma client wired to `web/prisma/schema.prisma`.
- **Database**: PostgreSQL running locally (`trend_mr` db), schema pushed via `prisma db push`, seeded with Admin/ASM/MR + sample Territory/Doctor/Chemist/Hospital.
- **DevOps**: GitHub Actions pipeline — not yet set up (no git repo initialized in this workspace).

### Week 2: User Authentication & Device Binding — ✅ Done
- **API**: `POST /api/auth/login/manager`, `/api/auth/login/mr`, `/api/auth/refresh` built. JWT payload has `sub` (userId) and `role`.
- **Security**: Device UUID mismatch check implemented in MR login route.
- **Mobile**: ~~Flutter~~ Built as **Expo/React Native** instead (`mobile/app`), with `login.tsx` and secure local auth service.

### Week 3: Biometric selfie match & Attendance check — ◐ Partial
- **Frontend (Mobile)**: Camera/selfie capture — not yet implemented.
- **Backend API**: Face matching — not yet implemented (attendance check-in currently trusts device-submitted coordinates only, no biometric gate).
- **Attendance Logging**: ✅ `Attendance` check-in/check-out routes live (`/api/mr/attendance/check-in`, `/check-out`, `/today`).

### Week 4: Geofenced DCR Logs & MVP Check — ✅ Done
- **API**: `/api/mr/visits` (POST) handles DCR submission.
- **Geofence Check**: `haversineDistanceKm` in `web/lib/gps.ts` validates against 100m threshold.
- **QA Gate**: Jest configured (`web/jest.config.js`, `web/__tests__`); coordinate mock test coverage not yet written.
