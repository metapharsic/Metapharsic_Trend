/**
 * costBasis() must never treat a SELLING price as a cost.
 *
 * Regression test for the invoice ledger reading -35% and -53% margins on
 * profitable orders: free goods are charged at cost, and the "cost" used was
 * the PTS, which already carries the ~40% company markup.
 */
import {
  costBasis,
  profitFor,
  round2,
  type PricedProduct,
} from "@/lib/pricing";

const DEFAULT_COMPANY = 40;
const DEFAULT_STOCKIST = 10;
const DEFAULT_CHEMIST = 20;

function assertFinitePositive(n: number, label: string): void {
  if (!Number.isFinite(n)) throw new Error(`${label} is not finite: ${n}`);
  if (n < 0) throw new Error(`${label} is negative: ${n}`);
}

describe("costBasis", () => {
  it("prefers a real purchaseRate and marks it exact", () => {
    const product: PricedProduct = {
      purchaseRate: 100,
      pts: 140,
      ptr: 155.56,
      price: 194.45,
    };
    const basis = costBasis(product);
    expect(basis.value).toBe(100);
    expect(basis.source).toBe("purchaseRate");
    expect(basis.exact).toBe(true);
    expect(basis.derivedUsing).toBeUndefined();
  });

  it("removes the company markup when deriving cost from PTS", () => {
    // 40% markup on cost: pts = cost * 1.4, so 140 -> 100, NOT 140.
    const basis = costBasis({ pts: 140 });
    expect(basis.value).toBe(100);
    expect(basis.source).toBe("pts");
    expect(basis.exact).toBe(false);
    expect(basis.derivedUsing).toEqual({
      companyMarkupPct: DEFAULT_COMPANY,
      stockistMarginPct: DEFAULT_STOCKIST,
      chemistMarginPct: DEFAULT_CHEMIST,
    });
  });

  it("steps PTR down through the stockist margin then the company markup", () => {
    // ptr 100 -> pts 100 * 0.9 = 90 -> cost 90 / 1.4 = 64.29
    const basis = costBasis({ ptr: 100 });
    expect(basis.value).toBe(64.29);
    expect(basis.source).toBe("ptr");
    expect(basis.exact).toBe(false);
    expect(basis.value).toBeLessThan(90); // cost < pts
    expect(basis.value).toBeLessThan(100); // cost < ptr
  });

  it("steps an MRP-like price down through chemist, stockist and company", () => {
    // price 200 -> ptr 160 -> pts 144 -> cost 144 / 1.4 = 102.86
    const basis = costBasis({ price: 200 });
    expect(basis.value).toBe(102.86);
    expect(basis.source).toBe("price");
    expect(basis.exact).toBe(false);
    // cost < pts < ptr < price
    expect(basis.value).toBeLessThan(144);
    expect(144).toBeLessThan(160);
    expect(160).toBeLessThan(200);
  });

  it("returns 0 / none for zero, missing and garbage values", () => {
    const cases: (PricedProduct | null | undefined)[] = [
      undefined,
      null,
      {},
      { purchaseRate: 0, pts: 0, ptr: 0, price: 0 },
      { purchaseRate: -5, pts: -140, ptr: null, price: undefined },
      { purchaseRate: "abc", pts: "", ptr: "NaN", price: "xyz" } as unknown as PricedProduct,
    ];
    for (const product of cases) {
      const basis = costBasis(product);
      assertFinitePositive(basis.value, `costBasis(${JSON.stringify(product)}).value`);
      expect(basis.value).toBe(0);
      expect(basis.source).toBe("none");
      expect(basis.exact).toBe(false);
    }
  });

  it("honours a product-supplied marginStructure over the defaults", () => {
    const product: PricedProduct = {
      pts: 125,
      marginStructure: JSON.stringify({
        chemistMarginPct: 15,
        stockistMarginPct: 5,
        companyMarginPct: 25,
      }),
    };
    const basis = costBasis(product);
    // 125 / 1.25 = 100, not 125 / 1.4 = 89.29
    expect(basis.value).toBe(100);
    expect(basis.source).toBe("pts");
    expect(basis.derivedUsing).toEqual({
      companyMarkupPct: 25,
      stockistMarginPct: 5,
      chemistMarginPct: 15,
    });
  });

  it("falls back to defaults when marginStructure is garbage", () => {
    const basis = costBasis({ pts: 140, marginStructure: "not json at all" });
    expect(basis.value).toBe(100);
    expect(basis.derivedUsing?.companyMarkupPct).toBe(DEFAULT_COMPANY);
  });
});

describe("profitFor - the real invoice case", () => {
  it("reports a POSITIVE profit for 10 billed + 5 free at pts 75.67", () => {
    // Before the fix: cost 75.67 * 15 = 1135.05 against revenue 840.80 = -35%.
    const product: PricedProduct = { pts: 75.67 };
    const unitCost = costBasis(product);
    expect(unitCost.value).toBe(54.05); // 75.67 / 1.4
    expect(unitCost.source).toBe("pts");
    expect(unitCost.exact).toBe(false);

    const result = profitFor([
      { quantity: 10, price: 84.08, freeQty: 5, product },
    ]);

    expect(result.revenue).toBe(840.8); // 84.08 * 10
    expect(result.cost).toBe(810.75); // 54.05 * 15
    expect(result.profitAmount).toBe(30.05);
    expect(result.profitPct).toBe(3.57);
    expect(result.profitAmount).toBeGreaterThan(0);
    expect(result.exact).toBe(false);
    expect(result.sources).toEqual(["pts"]);
  });

  it("keeps profitPct null when there is no revenue", () => {
    const result = profitFor([
      { quantity: 0, price: 0, freeQty: 5, product: { pts: 140 } },
    ]);
    expect(result.revenue).toBe(0);
    expect(result.profitPct).toBeNull();
    expect(result.cost).toBe(500); // 100 * 5 free
  });

  it("never produces NaN or Infinity from empty or broken lines", () => {
    const result = profitFor([
      { quantity: NaN, price: "oops", freeQty: NaN, product: {} },
    ]);
    for (const n of [result.revenue, result.cost, result.profitAmount]) {
      if (!Number.isFinite(n)) throw new Error(`non-finite profit figure: ${n}`);
    }
    expect(round2(result.profitAmount)).toBe(0);
  });
});
