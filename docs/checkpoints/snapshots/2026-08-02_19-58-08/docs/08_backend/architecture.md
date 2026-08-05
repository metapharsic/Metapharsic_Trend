# Backend Architecture & Services

This document details NestJS module scaffolding and service-to-service communication layers.

---

## 1. Directory Structure

Each NestJS microservice organizes files by domains:

```
/src
  /modules
    /auth               # User logins, device tokens
    /sfa                # DCRs, TourPlans, LocationLogs
    /crm                # Doctors, Chemists, Tenders
    /hrms               # Attendances, Payroll, Leaves
    /expense            # Claims, Limits, OCR scans
  /common               # Guards, custom decorators, filters
  /prisma               # Prisma client wrapper service
  main.ts               # App entrypoint
```

---

## 2. Core Service Communication

- **Internal Calls**: Services fetch data synchronously using **gRPC client connections**.
- **Asynchronous Work**: Event-driven jobs (e.g. DCR submissions updating AI priority indexes) are dispatched to **RabbitMQ exchanges** with routing keys:
  - `sfa.dcr.created`
  - `expense.claim.submitted`
- **Background Jobs**: Heavy operations (like monthly payroll runs or visual aid PDF compressions) use **BullMQ** backed by Redis.
