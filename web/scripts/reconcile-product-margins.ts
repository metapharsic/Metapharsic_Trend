import { db } from "../lib/db";
import { ProductPricingAgentsService } from "../services/product-pricing-agents.service";

async function main() {
  const products = await db.product.findMany();
  console.log(`Auditing and initializing ${products.length} products with Multi-Agent Pricing...`);

  for (const p of products) {
    const mrp = Number(p.mrp || p.price || 100);
    // Standard pharma margins: Chemist 20%, Stockist 10%, Company Gross 40%
    const pricing = ProductPricingAgentsService.calculatePricing({
      mrp,
      chemistMarginPct: 20,
      stockistMarginPct: 10,
      companyMarginPct: 40,
      autoCalculate: true,
    });

    console.log(`Product: ${p.name} (${p.sku})`);
    console.log(`  Old: MRP ${p.mrp} | PTR ${p.ptr} | PTS ${p.pts}`);
    console.log(`  New Reconciled: MRP ${pricing.mrp} | PTR ${pricing.ptr} | PTS ${pricing.pts} | Purchase Rate ${pricing.purchaseRate}`);

    await db.product.update({
      where: { id: p.id },
      data: {
        mrp: pricing.mrp,
        ptr: pricing.ptr,
        pts: pricing.pts,
        purchaseRate: pricing.purchaseRate,
        price: pricing.ptr,
        marginStructure: pricing.marginStructureJson,
      },
    });
  }

  console.log("All products updated with valid, non-inverted margin structures.");
}

main().finally(() => process.exit(0));
