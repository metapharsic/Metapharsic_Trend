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
- **Asynchronous Work**: Event-driven messages (e.g., DCR submissions updating AI priority indexes) are published to **local Apache Kafka topics** (brokered at `localhost:9092`):
  - `dcr-submissions` (tracks visit check-in events)
  - `expense-claims` (tracks expense claim entries)
- **Background Jobs**: Heavy operations (like monthly payroll runs or visual aid PDF compressions) use **BullMQ** backed by Redis.
