# Role-Based Access Control (RBAC)

This document contains the security authorization matrix for Pharma OS. All endpoint permissions must enforce this table.

---

## Access Matrix

| Role | Core Capabilities | Data Visibility Scope |
|------|-------------------|-------------------------|
| **MD (Managing Director)** | View national dashboard, financial KPIs, overall profitability. | Global (All Territories) |
| **NSM (Nat. Sales Manager)** | Zone-level performance, campaign push, target planning. | National |
| **ZSM (Zone Sales Manager)** | Multi-region analytics, ASM performance metrics. | Zone |
| **RM (Regional Manager)** | Regional KPIs, ASM target mapping, high-value expense approvals. | Region |
| **ASM (Area Sales Manager)** | Territory control, DCR reviews, standard expense approvals, TP approvals. | Area |
| **MR (Medical Rep)** | Daily DCR submission, TP creation, orders, collections, sample distribution. | Assigned Territory only |
| **Distributor** | View primary orders, report secondary delivery, inventory levels. | Own Distributor Account |
| **Doctor Portal** | Provide feedback on product availability, sample requests. | Own Doctor Account |
| **HR (Human Resources)** | Manage payroll, view geo/face check-in records, LMS progress. | Global (HR specific) |
| **Finance** | Audit and pay approved expenses, manage payment collections. | Global (Finance specific) |
| **Warehouse** | Inventory tracking, batch expiry logging. | System Inventory |
| **Admin** | System control, role edits, data wipe, device binding resets. | Global (All data) |

---

## Device Binding Rule
- An MR/ASM account is bound to a single device hardware UUID during registration.
- Any attempt to log in from a secondary device triggers a security lockout until Admin resets the device token.
