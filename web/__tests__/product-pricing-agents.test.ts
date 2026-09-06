import { ProductPricingAgentsService } from "../services/product-pricing-agents.service";

describe("ProductPricingAgentsService Multi-Agent Pipeline", () => {
  it("computes reverse (MRP-anchored) pricing correctly with standard percentages", () => {
    // MRP = 100, Chemist = 20% (margin ON MRP), Stockist = 10% (margin ON PTR),
    // Company = 40% (MARKUP ON COST, so reversing it divides, it does not subtract).
    const result = ProductPricingAgentsService.calculatePricing({
      mrp: 100,
      chemistMarginPct: 20,
      stockistMarginPct: 10,
      companyMarginPct: 40,
      autoCalculate: true,
    });

    expect(result.mrp).toBe(100);
    // Chemist margin is a margin ON THE SELLING PRICE (MRP):
    //   PTR = 100 * (1 - 0.20) = 80
    expect(result.ptr).toBe(80);
    // Stockist margin is a margin ON THE SELLING PRICE (PTR):
    //   PTS = 80 * (1 - 0.10) = 72
    expect(result.pts).toBe(72);
    // Company margin is a MARKUP ON COST (pts = cost * 1.40), so the inverse
    // is a DIVISION:
    //   Purchase Rate = 72 / 1.40 = 51.428571... -> 51.43
    // (The old expectation of 72 * (1 - 0.40) = 43.2 pinned a bug: it treated
    //  a markup on cost as a margin on price and understated the real cost.)
    expect(result.purchaseRate).toBe(51.43);

    expect(result.hierarchyValid).toBe(true);
    expect(result.warnings.length).toBe(0);

    expect(result.margins.chemistMarginPct).toBe(20);
    expect(result.margins.chemistMarginAmount).toBe(20);
    expect(result.margins.stockistMarginPct).toBe(10);
    expect(result.margins.stockistMarginAmount).toBe(8);
    expect(result.margins.companyMarginPct).toBe(40);
    // Company margin amount = PTS - Purchase Rate = 72 - 51.43 = 20.57
    expect(result.margins.companyMarginAmount).toBe(20.57);
    // Markup ON COST = (72 - 51.43) / 51.43 * 100 = 39.996...% -> 40%
    expect(result.margins.markupOnCostPct).toBe(40);
    // Overall gross margin is a margin ON MRP, a different base from the
    // 40% markup above: (100 - 51.43) / 100 * 100 = 48.57%
    expect(result.margins.overallGrossMarginPct).toBe(48.57);

    // 4 Agents verified
    expect(result.agents.length).toBe(4);
    expect(result.agents[0].id).toBe("agent-pricing-formula");
    expect(result.agents[1].id).toBe("agent-margin-compliance");
    expect(result.agents[2].id).toBe("agent-inventory-valuation");
    expect(result.agents[3].id).toBe("agent-catalog-sync");
  });

  it("detects and flags inverted pricing hazards", () => {
    // Inverted pricing: PTS > PTR
    const result = ProductPricingAgentsService.calculatePricing({
      mrp: 100,
      ptr: 80,
      pts: 90, // PTS > PTR hazard!
      purchaseRate: 50,
      autoCalculate: false,
    });

    expect(result.hierarchyValid).toBe(false);
    expect(result.warnings.some((w) => w.includes("Inverted Pricing"))).toBe(true);
    expect(result.agents[1].status).toBe("WARNING");
  });

  it("infers margin percentages accurately from manual price inputs", () => {
    const result = ProductPricingAgentsService.calculatePricing({
      mrp: 100,
      ptr: 80, // (100 - 80) / 100 = 20%
      pts: 72, // (80 - 72) / 80 = 10%
      purchaseRate: 51.43, // (72 - 51.43) / 51.43 = 40% markup on purchase rate
      autoCalculate: false,
    });

    expect(result.margins.chemistMarginPct).toBe(20);
    expect(result.margins.stockistMarginPct).toBe(10);
    expect(result.margins.companyMarginPct).toBe(40);
    expect(result.hierarchyValid).toBe(true);
  });

  it("parses stored marginStructure JSON string", () => {
    const jsonStr = JSON.stringify({
      chemistMarginPct: 25,
      stockistMarginPct: 12,
      companyMarginPct: 45,
      purchaseRate: 50.5,
      autoCalculate: true,
    });

    const parsed = ProductPricingAgentsService.parseMarginStructure(jsonStr);
    expect(parsed).not.toBeNull();
    expect(parsed?.chemistMarginPct).toBe(25);
    expect(parsed?.stockistMarginPct).toBe(12);
    expect(parsed?.companyMarginPct).toBe(45);
    expect(parsed?.purchaseRate).toBe(50.5);
    expect(parsed?.autoCalculate).toBe(true);
  });

  it("computes Cost-Up pricing directly ON Purchase Rate when anchorMode is PURCHASE_RATE", () => {
    // Purchase Rate = 50, Company Margin = 40% on cost, Stockist = 10% on PTR, Chemist = 20% on MRP
    const result = ProductPricingAgentsService.calculatePricing({
      anchorMode: "PURCHASE_RATE",
      purchaseRate: 50,
      companyMarginPct: 40,
      stockistMarginPct: 10,
      chemistMarginPct: 20,
      autoCalculate: true,
    });

    expect(result.purchaseRate).toBe(50);
    // PTS = 50 * (1 + 0.40) = 70
    expect(result.pts).toBe(70);
    // PTR = 70 / (1 - 0.10) = 77.78
    expect(result.ptr).toBe(77.78);
    // MRP = 77.78 / (1 - 0.20) = 97.23
    expect(result.mrp).toBeGreaterThanOrEqual(97.2);
    expect(result.mrp).toBeLessThanOrEqual(97.3);

    expect(result.hierarchyValid).toBe(true);
    expect(result.margins.markupOnCostPct).toBe(40);
    expect(result.margins.companyMarginAmount).toBe(20);
    expect(result.anchorMode).toBe("PURCHASE_RATE");
  });
});
