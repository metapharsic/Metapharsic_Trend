/**
 * purchaseProfitFor() must use ONLY the real purchaseRate as cost -- never
 * derive from PTS/PTR/price like costBasis() does. This is the admin
 * "Commercial Ledger" screen's strict, no-guessing profit figure.
 */
import { costBasis, purchaseProfitFor, round2, type PricedProduct } from "@/lib/pricing";

function assertFinite(n: number, label: string): void {
  if (!Number.isFinite(n)) throw new Error(`${label} is not finite: ${n}`);
}

describe("purchaseProfitFor", () => {
  it("computes revenue minus real purchase cost when every line is priced", () => {
    const lines = [
      { quantity: 10, price: 84.08, freeQty: 5, product: { purchaseRate: 60 } },
      { quantity: 4, price: 50, freeQty: 0, product: { purchaseRate: 30 } },
    ];
    const result = purchaseProfitFor(lines);

    const expectedRevenue = round2(84.08 * 10 + 50 * 4);
    const expectedCost = round2(60 * (10 + 5) + 30 * (4 + 0));
    const expectedProfit = round2(expectedRevenue - expectedCost);

    expect(result.revenue).toBe(expectedRevenue);
    expect(result.purchaseCost).toBe(expectedCost);
    expect(result.profitAmount).toBe(expectedProfit);
    expect(result.complete).toBe(true);
    expect(result.unpricedUnits).toBe(0);
    expect(result.profitPct).toBe(round2((expectedProfit / expectedRevenue) * 100));
  });

  it("zeroes the cost of only the line missing purchaseRate, not the whole invoice", () => {
    const priced = { quantity: 10, price: 84.08, freeQty: 5, product: { purchaseRate: 60 } };
    const unpriced = { quantity: 3, price: 20, freeQty: 1, product: { purchaseRate: undefined } };
    const result = purchaseProfitFor([priced, unpriced]);

    const expectedRevenue = round2(84.08 * 10 + 20 * 3);
    const expectedCost = round2(60 * 15); // only the priced line
    const expectedProfit = round2(expectedRevenue - expectedCost);

    expect(result.revenue).toBe(expectedRevenue);
    expect(result.purchaseCost).toBe(expectedCost);
    expect(result.profitAmount).toBe(expectedProfit);
    expect(result.complete).toBe(false);
    expect(result.unpricedUnits).toBe(4); // 3 billed + 1 free on the unpriced line
  });

  it("returns profitPct null when revenue is 0", () => {
    const result = purchaseProfitFor([
      { quantity: 0, price: 0, freeQty: 5, product: { purchaseRate: 60 } },
    ]);
    expect(result.revenue).toBe(0);
    expect(result.profitPct).toBeNull();
    assertFinite(result.profitAmount, "profitAmount");
    assertFinite(result.purchaseCost, "purchaseCost");
  });

  it("never produces NaN/Infinity from a zero or negative purchaseRate", () => {
    const cases = [
      { quantity: 5, price: 10, freeQty: 0, product: { purchaseRate: 0 } },
      { quantity: 5, price: 10, freeQty: 0, product: { purchaseRate: -20 } },
      { quantity: 5, price: 10, freeQty: 0, product: null },
      { quantity: 5, price: 10, freeQty: 0, product: undefined },
    ];
    for (const line of cases) {
      const result = purchaseProfitFor([line]);
      assertFinite(result.revenue, "revenue");
      assertFinite(result.purchaseCost, "purchaseCost");
      assertFinite(result.profitAmount, "profitAmount");
      expect(result.purchaseCost).toBe(0);
      expect(result.complete).toBe(false);
      expect(result.unpricedUnits).toBe(5);
    }
  });

  it("gives a DIFFERENT answer than costBasis-derived profit for the same invoice when purchaseRate is absent", () => {
    // Real invoice from the cost-basis regression: 10 billed + 5 free at pts 75.67,
    // billed price 84.08. costBasis() derives cost 54.05/unit from PTS (removing the
    // 40% company markup) and reports a positive profit. purchaseProfitFor() has no
    // purchaseRate to go on here, so it must NOT invent one -- it reports 0 cost for
    // that line, flags it incomplete, and revenue itself becomes the (misleading,
    // but honest) "profit" since we truly do not know what was paid.
    const product: PricedProduct = { pts: 75.67 };
    const derivedBasis = costBasis(product);
    expect(derivedBasis.value).toBe(54.05); // PTS-derived estimate, exact: false

    const lines = [{ quantity: 10, price: 84.08, freeQty: 5, product: { purchaseRate: undefined } }];
    const strict = purchaseProfitFor(lines);

    expect(strict.purchaseCost).toBe(0);
    expect(strict.complete).toBe(false);
    expect(strict.unpricedUnits).toBe(15);
    expect(strict.revenue).toBe(840.8);
    expect(strict.profitAmount).toBe(840.8);

    // The PTS-derived cost basis would have charged 54.05 * 15 = 810.75 -- a
    // materially different (lower, margin-informed) cost than the strict 0.
    const derivedCost = round2(derivedBasis.value * 15);
    expect(derivedCost).not.toBe(strict.purchaseCost);
    expect(derivedCost).toBeGreaterThan(0);
  });
});
