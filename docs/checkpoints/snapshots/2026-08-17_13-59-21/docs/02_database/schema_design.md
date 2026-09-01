# Database Schema Design

This document details the complete relational entities of Pharma OS. All database model definitions must conform to this schema structure.

---

## Core Entities & Descriptions

| Entity | Description | Core Relations |
|--------|-------------|----------------|
| **User** | User credentials, roles, active flag, and device UUID | Belongs to `Employee` |
| **Employee** | Detailed employee records (MR, ASM, RM, etc.) | Maps to `Territory`, reports to Manager (`Employee`), has `Payroll` |
| **Territory** | Geographical sales boundaries | Maps to `Employee`, contains `Doctor`, `Chemist`, `Hospital` |
| **Doctor** | Healthcare professionals visited by MRs | Linked to `Territory`, has `Visit` records, `crmProfile` |
| **DoctorCRMProfile** | Sub-metrics feeding Doctor Intelligence Score | Linked to `Doctor` (One-to-One) |
| **Chemist** | Pharmacies visited by MRs | Linked to `Territory`, places `Order`, submits `Claim` |
| **Hospital** | Hospitals containing clinical departments | Linked to `Territory`, has bed strength and contacts |
| **Distributor** | Wholesale supply points (orders secondary sales) | Linked to `Territory`, handles primary `Order`, resolves `Claim` |
| **Product** | Pharmaceutical items, pack sizes, strengths | Mapped to `VisualAid` files, has price tiers (MRP, PTR, PTS) |
| **Order** | Wholesale and retail bookings | Mapped to `Chemist`/`Distributor`, contains `OrderItem` list |
| **Visit** | Records of MR daily visits (DCR) | Made by `Employee` to `Doctor`/`Chemist`, contains samples/gifts |
| **CompetitorLog** | Tracks competitor brands detailed in visit | Linked to `Visit` |
| **SampleInventory** | Allocated samples and inventory tracking | Linked to `Employee` and `Product` |
| **GiftCatalog** | Promotional material catalog and prices | Linked to distributed `Gift` |
| **LeaveRequest** | HRMS Casual, Sick, and Planned leaves | Submitted by `Employee`, approved by ASM manager |
| **Payroll** | Monthly salaries, PF, tax, incentives | Linked to `Employee` per month |
| **Claim** & **CreditNote** | Product damaged/expiry claims | Submitted by `Chemist`, audited by MR, resolved by `Distributor` |
| **LMSCourse** & **LMSEnrollment**| Training materials and progress trackers | Enrolled by `Employee` |
| **ChartOfAccount** *(planned)* | Accounts module — account tree (ASSET/LIABILITY/INCOME/EXPENSE/EQUITY) | Self-referencing `parentId`, referenced by `LedgerEntry` |
| **LedgerTransaction** *(planned)* | Accounts module — one row per journal/auto-posted transaction | Sources from `Invoice`/`Collection`/`Expense`/`Payroll` via `sourceType`+`sourceId` |
| **LedgerEntry** *(planned)* | Accounts module — debit/credit line, sum(debit)=sum(credit) per transaction | Linked to `LedgerTransaction` and `ChartOfAccount` |

---

## Database Rules
- **Primary Keys**: Every table must use a UUID string as its primary key.
- **Timestamps**: Every table must track creation (`createdAt`) and update (`updatedAt`) dates.
- **Audit Logging**: Write operations must generate corresponding audit log records tracking the user, action, and changes.
