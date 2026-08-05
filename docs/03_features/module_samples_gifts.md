# Module: Sample & Gift Compliance

Sample and gift distribution is subject to strict regulatory compliance and budget constraints.

---

## 1. Sample Distribution & Accountability

### MR Inventory
- Warehouse allocations are tracked in the `SampleInventory` table per representative.
- Distributed samples logged in DCR entries decrement this balance.

### Compliance Rules
- **Doctor Quota Limit**: Caps maximum samples per doctor per month (e.g., maximum 5 samples of a single SKU).
- **Expiries**: Flags samples in the rep's bag that are within 30 days of batch expiry.

---

## 2. Gift & Promotion Management

### Catalog Controls
- All promotional gifts must exist in the **[GiftCatalog](file:///c:/Trend_MR/docs/02_database/production_schema.prisma)**.
- Gifts have designated values (PTR equivalent) and regional budget balances.

### Budgets & Approvals
- Enforces an automated warning if monthly gift spending in a territory exceeds target allocations.
- Highly valuable items require prior ASM digital signature authorization.
