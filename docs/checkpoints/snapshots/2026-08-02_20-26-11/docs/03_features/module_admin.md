# Module: Admin Governance

The Admin module handles platform configuration, security gates, and territory management.

---

## 1. User & Identity Governance
- **MFA Configuration**: Admin configures multi-factor authentication requirements for specific roles (e.g. Finance, MD, Admin).
- **Device Bindings**: Enforces hardware UUID binding locks. Admin dashboard features a **Reset Device Token** tool to authorize new devices for MRs.

---

## 2. Territory Hierarchy
- Defines multi-tiered geological lines:
  `Country -> Zone -> Region -> Area -> Territory -> HQ`.
- Admin panel manages re-assignments (moving an MR from Territory A to B and auto-mapping their clinics).

---

## 3. Global Rule Engine Configurations
- **Visit Rules**: Configures visit limits and retrospect log limits (DCR log limit, e.g. 24 hours).
- **Expense Policies**: Maps daily allowance tiers per category and role.
- **Geofence Parameters**: Establishes check-in allowed radius (e.g. 100 meters) and accuracy limits.
