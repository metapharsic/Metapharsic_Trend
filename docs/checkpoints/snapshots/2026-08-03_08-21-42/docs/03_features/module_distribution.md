# Module: Distributor & Sales Orders

This document details primary and secondary sales ordering cycles, along with distributor controls.

---

## 1. Distributor Master & Credit Controls
- **Credit Limits**: Enforces transactional credit ceilings on primary orders.
- **Credit Limit Breaches**: If an order exceeds the distributor's limit, the system holds it in `PENDING` status, requiring Sales Director approval.
- **Aged Outstandings**: Blocks orders if distributor has unpaid invoices older than 45 days.

---

## 2. Ordering Cycles

### Primary Orders (Company → Distributor)
- Captures wholesale bulk orders.
- Triggers inventory deduction at the central warehouse and issues invoices.
- **Auto-Indent**: AI analyzes previous week's secondary chemist sales and stock levels to auto-fill draft orders, minimizing stock-outs.

### Secondary Orders (Distributor → Chemist)
- MR acts as the ordering agent during daily visits.
- MR selects Chemist, items, and auto-calculates volume-based pricing discounts.
- The order is routed to the designated Distributor for fulfillment.
