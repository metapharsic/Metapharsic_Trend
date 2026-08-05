import { OrderStatus } from "@prisma/client";

/**
 * Order fulfilment state machine.
 *
 * Distributors drive PENDING -> CONFIRMED -> SHIPPED -> DELIVERED. Skipping a
 * stage (e.g. PENDING straight to SHIPPED) or moving backward is rejected: the
 * status also feeds outstanding-invoice and collections reporting, so an
 * inconsistent history would corrupt those numbers, not just look untidy.
 *
 * CANCELLED is reachable from PENDING or CONFIRMED only — once a distributor has
 * shipped stock, cancelling is a returns/credit-note problem, not a status flip.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): TransitionResult {
  if (from === to) {
    return { allowed: false, reason: `Order is already ${to}` };
  }
  if (ALLOWED_TRANSITIONS[from].includes(to)) {
    return { allowed: true };
  }
  if (from === "DELIVERED" || from === "CANCELLED") {
    return { allowed: false, reason: `${from} orders are final and cannot change status` };
  }
  return { allowed: false, reason: `Cannot move an order from ${from} directly to ${to}` };
}

/** Credit exposure: outstanding = unpaid invoices, utilisation guards a null/zero limit. */
export function creditUtilizationPercent(outstanding: number, creditLimit: number | null): number | null {
  if (creditLimit === null || creditLimit <= 0) return null;
  return Math.round((outstanding / creditLimit) * 1000) / 10;
}
