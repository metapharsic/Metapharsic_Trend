# System Blueprint & Platform Architecture

This document outlines the high-level positioning, architecture, security, and enterprise standards for **Pharma OS**.

---

## 1. Platform Positioning
> **Pharma Commercial Operating System (Pharma OS)**  
A unified AI-powered platform for Sales, Distribution, HR, Compliance, and Analytics.

---

## 2. High-Level Architecture

```
Mobile App (Flutter)
        ↓
API Gateway
        ↓
Microservices Layer (NestJS / Spring Boot)
        ↓
Core Services
   - SFA Service
   - CRM Service
   - HRMS Service
   - Expense Service
   - Order & Distribution Service
   - AI Service
        ↓
Database Layer
   - PostgreSQL (Transactional)
   - Redis (Cache)
   - Elasticsearch (Search & Reports)
   - S3/Blob (Documents & Media)
```

---

## 3. Enterprise Security Model

- **End-to-End Encryption**: Secure transit (TLS 1.3) and secure data at rest (AES-256).
- **Document & Media Storage**: Encrypted files stored on S3/Blob storage with expiring presigned URLs.
- **Audit Trails**: Every write/update record must log changes, timestamp, and executing User ID.
- **Device Binding**: Mobile app strictly binds to a single physical device UUID per user login.
- **Jailbreak/Root Detection**: The mobile client triggers auto data-wipe on jailbroken/rooted devices.
- **GDPR Readiness**: Implementation of Right to be Forgotten (deletion/anonymization of Doctor/User data) and Data Export utilities.

---

## 4. Enterprise Standards
- **Unified Ecosystem**: A single platform handling SFA, HRMS, CRM, and Distribution to avoid data silos.
- **AI-Driven Decisions**: Intelligence layers for routes, CRM prioritization, and forecasting.
- **Offline First**: All transactional field work operates offline and syncs reliably when connection returns.
- **Fraud Prevention**: Anti-fraud checks (Fake GPS recognition, DCR timestamp checks, visit clustering).
