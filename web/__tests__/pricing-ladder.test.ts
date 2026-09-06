import { ProductPricingAgentsService } from "../services/product-pricing-agents.service";

/**
 * Pricing ladder invariants.
 *
 * The forward (PURCHASE_RATE) and reverse (MRP) directions must be exact
 * inverses. companyMarginPct is a MARKUP ON COST, so its inverse is a
 * division by (1 + m/100) - not a subtraction of m%.
 */
describe("pricing ladder round-trip", () => {
  const MARGINS = {
    companyMarginPct: 40,
    stockistMarginPct: 10,
    chemistMarginPct: 20,
  };

  it("round-trips purchase rate 100 through MRP and back", () => {
    const forward = ProductPricingAgentsService.calculatePricing({
      purchaseRate: 100,
      ...MARGINS,
      autoCalculate: true,
      anchorMode: "PURCHASE_RATE",
    });

    expect(forward.pts).toBeCloseTo(140, 2);
    expect(forward.ptr).toBeCloseTo(155.56, 1);
    expect(forward.mrp).toBeCloseTo(194.44, 1);

    const reverse = ProductPricingAgentsService.calculatePricing({
      mrp: forward.mrp,
      ...MARGINS,
      autoCalculate: true,
      anchorMode: "MRP",
    });

    expect(Math.abs(reverse.purchaseRate - 100)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(reverse.pts - forward.pts)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(reverse.ptr - forward.ptr)).toBeLessThanOrEqual(0.02);
  });

  it("pins the known-bad case: reverse of pts 140 at 40% markup is 100, not 84", () => {
    // MRP whose reverse ladder lands exactly on PTS 140.
    const mrp = 140 / 0.9 / 0.8; // 194.444...
    const result = ProductPricingAgentsService.calculatePricing({
      mrp,
      ...MARGINS,
      autoCalculate: true,
      anchorMode: "MRP",
    });

    expect(Math.abs(result.pts - 140)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(result.purchaseRate - 100)).toBeLessThanOrEqual(0.02);
    // The old subtraction bug produced 140 * (1 - 0.40) = 84.
    expect(Math.abs(result.purchaseRate - 84)).toBeGreaterThan(10);
  });

  it("maintains purchaseRate < pts < ptr < mrp for realistic inputs", () => {
    const cases = [
      { purchaseRate: 12.5, companyMarginPct: 35, stockistMarginPct: 10, chemistMarginPct: 20 },
      { purchaseRate: 100, companyMarginPct: 40, stockistMarginPct: 10, chemistMarginPct: 20 },
      { purchaseRate: 3.4, companyMarginPct: 60, stockistMarginPct: 8, chemistMarginPct: 16 },
      { purchaseRate: 875, companyMarginPct: 25, stockistMarginPct: 12, chemistMarginPct: 24 },
    ];

    for (const input of cases) {
      const r = ProductPricingAgentsService.calculatePricing({ ...input, autoCalculate: true });
      if (!(r.purchaseRate < r.pts && r.pts < r.ptr && r.ptr < r.mrp)) {
        throw new Error(
          `Hierarchy violated for ${JSON.stringify(input)}: ` +
            `purchaseRate=${r.purchaseRate} pts=${r.pts} ptr=${r.ptr} mrp=${r.mrp}`
        );
      }
      expect(r.hierarchyValid).toBe(true);
      expect(r.anchorMode).toBe("PURCHASE_RATE");

      // And it round-trips.
      const back = ProductPricingAgentsService.calculatePricing({
        mrp: r.mrp,
        companyMarginPct: input.companyMarginPct,
        stockistMarginPct: input.stockistMarginPct,
        chemistMarginPct: input.chemistMarginPct,
        autoCalculate: true,
        anchorMode: "MRP",
      });
      if (Math.abs(back.purchaseRate - input.purchaseRate) > 0.02) {
        throw new Error(
          `Round trip drifted for ${JSON.stringify(input)}: got ${back.purchaseRate}`
        );
      }
    }
  });

  it("produces no Infinity or NaN when purchase rate is zero or missing", () => {
    const inputs = [
      { purchaseRate: 0, autoCalculate: true },
      { autoCalculate: true },
      { purchaseRate: 0, mrp: 0, autoCalculate: true },
      { purchaseRate: 0, pts: 0, ptr: 0, mrp: 0, autoCalculate: false },
      { pts: 50, ptr: 60, mrp: 80, autoCalculate: false },
    ];

    for (const input of inputs) {
      const r = ProductPricingAgentsService.calculatePricing(input);
      const numbers: number[] = [
        r.mrp,
        r.ptr,
        r.pts,
        r.purchaseRate,
        r.margins.chemistMarginPct,
        r.margins.chemistMarginAmount,
        r.margins.stockistMarginPct,
        r.margins.stockistMarginAmount,
        r.margins.companyMarginPct,
        r.margins.companyMarginAmount,
        r.margins.overallGrossMarginPct,
        r.margins.markupOnCostPct,
      ];
      for (const n of numbers) {
        if (!Number.isFinite(n)) {
          throw new Error(
            `Non-finite value ${n} in result for input ${JSON.stringify(input)}`
          );
        }
      }
    }
  });

  it("clamps an impossible company margin instead of dividing by zero", () => {
    const r = ProductPricingAgentsService.calculatePricing({
      mrp: 200,
      companyMarginPct: -100,
      stockistMarginPct: 10,
      chemistMarginPct: 20,
      autoCalculate: true,
      anchorMode: "MRP",
    });

    expect(Number.isFinite(r.purchaseRate)).toBe(true);
    expect(r.purchaseRate).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes("Invalid Company Margin"))).toBe(true);
  });

  it("warns when MRP mode is forced while a real purchase rate exists", () => {
    const r = ProductPricingAgentsService.calculatePricing({
      mrp: 194.44,
      purchaseRate: 150,
      ...MARGINS,
      autoCalculate: true,
      anchorMode: "MRP",
    });

    const conflict = r.warnings.find((w) => w.includes("Purchase Rate Conflict"));
    if (!conflict) {
      throw new Error(`Expected a purchase rate conflict warning, got: ${JSON.stringify(r.warnings)}`);
    }
    expect(conflict).toContain("150");
  });

  it("defaults to PURCHASE_RATE anchoring when a positive purchase rate is supplied", () => {
    const r = ProductPricingAgentsService.calculatePricing({
      purchaseRate: 100,
      mrp: 500,
      ...MARGINS,
      autoCalculate: true,
    });
    expect(r.anchorMode).toBe("PURCHASE_RATE");
    expect(r.purchaseRate).toBe(100);
  });
});
