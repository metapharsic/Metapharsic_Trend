import { ProductPricingAgentsService } from "../services/product-pricing-agents.service";

describe("ProductPricingAgentsService Multi-Agent Pipeline", () => {
  it("computes reverse (MRP-anchored) pricing correctly with standard percentages (PTS deferred)", () => {
    // MRP = 100, Chemist = 20% (margin ON MRP),
    // Company = 60% (MARKUP ON COST, so reversing it divides, it does not subtract).
    const result = ProductPricingAgentsService.calculatePricing({
      mrp: 100,
      chemistMarginPct: 20,
      companyMarginPct: 60,
      autoCalculate: true,
    });

    expect(result.mrp).toBe(100);
    // Chemist margin is a margin ON THE SELLING PRICE (MRP):
    //   PTR = 100 * (1 - 0.20) = 80
    expect(result.ptr).toBe(80);
    // Company margin is a MARKUP ON COST (ptr = cost * 1.60):
    //   Purchase Rate = 80 / 1.60 = 50
    expect(result.purchaseRate).toBe(50);

    expect(result.hierarchyValid).toBe(true);
    expect(result.warnings.length).toBe(0);

    expect(result.margins.chemistMarginPct).toBe(20);
    expect(result.margins.chemistMarginAmount).toBe(20);
    expect(result.margins.companyMarginPct).toBe(60);
    // Company margin amount = PTR - Purchase Rate = 80 - 50 = 30
    expect(result.margins.companyMarginAmount).toBe(30);
    // Markup ON COST = (80 - 50) / 50 * 100 = 60%
    expect(result.margins.markupOnCostPct).toBe(60);
    // Overall gross margin is a margin ON MRP: (100 - 50) / 100 * 100 = 50%
    expect(result.margins.overallGrossMarginPct).toBe(50);

    // 4 Agents verified
    expect(result.agents.length).toBe(4);
    expect(result.agents[0].id).toBe("agent-pricing-formula");
    expect(result.agents[1].id).toBe("agent-margin-compliance");
    expect(result.agents[2].id).toBe("agent-inventory-valuation");
    expect(result.agents[3].id).toBe("agent-catalog-sync");
  });

  it("detects and flags inverted pricing hazards", () => {
    // Inverted pricing: PTR > MRP
    const result = ProductPricingAgentsService.calculatePricing({
      mrp: 100,
      ptr: 110, // PTR > MRP hazard!
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
      purchaseRate: 50, // (80 - 50) / 50 = 60% markup on purchase rate
      autoCalculate: false,
    });

    expect(result.margins.chemistMarginPct).toBe(20);
    expect(result.margins.companyMarginPct).toBe(60);
    expect(result.hierarchyValid).toBe(true);
  });

  it("parses stored marginStructure JSON string", () => {
    const jsonStr = JSON.stringify({
      chemistMarginPct: 25,
      companyMarginPct: 45,
      purchaseRate: 50.5,
      autoCalculate: true,
    });

    const parsed = ProductPricingAgentsService.parseMarginStructure(jsonStr);
    expect(parsed).not.toBeNull();
    expect(parsed?.chemistMarginPct).toBe(25);
    expect(parsed?.companyMarginPct).toBe(45);
    expect(parsed?.purchaseRate).toBe(50.5);
    expect(parsed?.autoCalculate).toBe(true);
  });

  it("computes Cost-Up pricing directly ON Purchase Rate when anchorMode is PURCHASE_RATE", () => {
    // Purchase Rate = 50, Company Margin = 60% on cost, Chemist = 20% on MRP
    const result = ProductPricingAgentsService.calculatePricing({
      anchorMode: "PURCHASE_RATE",
      purchaseRate: 50,
      companyMarginPct: 60,
      chemistMarginPct: 20,
      autoCalculate: true,
    });

    expect(result.purchaseRate).toBe(50);
    // PTR = 50 * (1 + 0.60) = 80
    expect(result.ptr).toBe(80);
    // MRP = 80 / (1 - 0.20) = 100
    expect(result.mrp).toBe(100);

    expect(result.hierarchyValid).toBe(true);
    expect(result.margins.markupOnCostPct).toBe(60);
    expect(result.margins.companyMarginAmount).toBe(30);
    expect(result.anchorMode).toBe("PURCHASE_RATE");
  });
});
