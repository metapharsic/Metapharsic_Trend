# Module: Expense Claims

This document outlines travel logging, daily allowances, and OCR fraud detection rules.

---

## 1. Travel & Fuel Tracking
- **Auto-Distance Calculations**: Calculates travel distance (km) using coordinate logs in the `LocationLog` table.
- **Verification**: If claimed fuel distance differs from actual GPS distance by `> 15%`, the claim is flagged.
- **Allowance Tiers**: Allocates daily food/accommodation allowances based on location tier (Metro, Tier 1, Tier 2).

---

## 2. OCR Audit Checks
- **OCR Scan**: MR uploads receipts via mobile camera. The OCR service parses date, merchant name, transaction totals, and tax IDs.
- **Hash Checks**: Computes unique receipt file hashes to identify duplicate receipt submissions across different MR accounts.
- **Flagging**: Out-of-policy items (e.g., dates on receipts matching holidays or weekend leaves) trigger warning flags.
