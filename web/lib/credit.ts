/**
 * Chemist credit exposure — pure functions over a snapshot so the rules stay
 * testable and identical between the order-time guard and the dashboards.
 */

export type CreditStatus = "NO_LIMIT" | "OK" | "WARNING" | "BREACHED";

/** Outstanding balance crosses into WARNING at this fraction of the limit. */
export const CREDIT_WARNING_THRESHOLD = 0.8;

export interface CreditSnapshot {
  creditLimit: number | null;
  outstanding: number;
}

export function outstandingBalance(totalOrdered: number, totalCollected: number): number {
  return Math.max(0, round2(totalOrdered - totalCollected));
}

export function creditStatus({ creditLimit, outstanding }: CreditSnapshot): CreditStatus {
  if (creditLimit === null || creditLimit <= 0) return "NO_LIMIT";
  if (outstanding >= creditLimit) return "BREACHED";
  if (outstanding >= creditLimit * CREDIT_WARNING_THRESHOLD) return "WARNING";
  return "OK";
}

/**
 * Whether a prospective order of `orderValue` may proceed for a chemist
 * currently carrying `outstanding` against `creditLimit`. A null limit means
 * the chemist has no configured cap — unrestricted, matching existing
 * chemists created before credit limits existed.
 */
export function canPlaceOrder(
  { creditLimit, outstanding }: CreditSnapshot,
  orderValue: number
): { allowed: true } | { allowed: false; reason: string } {
  if (creditLimit === null || creditLimit <= 0) return { allowed: true };
  const projected = outstanding + orderValue;
  if (projected > creditLimit) {
    return {
      allowed: false,
      reason: `Order would push this chemist's outstanding to ${round2(projected)}, over their credit limit of ${creditLimit}. Collect payment first or raise the limit.`,
    };
  }
  return { allowed: true };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
