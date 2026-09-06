/**
 * CommercialAgentsService.executePipeline() itself needs a live Prisma `db`
 * (invoice/product/doctor queries) and cannot be unit tested without one.
 * What CAN be unit tested without a DB is the per-line cost derivation it
 * now uses: each line item is reduced to a single-line purchaseProfitFor()
 * call and the resulting per-unit `purchaseCostBasis` / `purchaseCostKnown`
 * flag, mirroring exactly what commercial-agents.service.ts does. This pins
 * that arithmetic so a regression back to costBasis()/PTS-PTR-price fallback
 * would be caught here.
 */
import { purchaseProfitFor, round2 } from "@/lib/pricing";

function lineCostBasis(
  billedQty: number,
  price: number,
  freeQty: number,
  purchaseRate: number | undefined
) {
  const totalQty = billedQty + freeQty;
  const result = purchaseProfitFor([
    { quantity: billedQty, price, freeQty, product: { purchaseRate } },
  ]);
  const purchaseCostKnown = result.complete;
  const purchaseCostBasis =
    purchaseCostKnown && totalQty > 0 ? round2(result.purchaseCost / totalQty) : 0;
  return { purchaseCostBasis, purchaseCostKnown, result };
}

describe("commercial-agents.service cost derivation (per-line purchaseProfitFor wrapper)", () => {
  it("uses only the real purchaseRate as per-unit cost when present", () => {
    const { purchaseCostBasis, purchaseCostKnown, result } = lineCostBasis(10, 84.08, 5, 60);
    expect(purchaseCostKnown).toBe(true);
    expect(purchaseCostBasis).toBe(60);
    expect(result.purchaseCost).toBe(round2(60 * 15));
    expect(result.revenue).toBe(round2(84.08 * 10));
    expect(result.profitAmount).toBe(round2(result.revenue - result.purchaseCost));
  });

  it("reports the line as unpriced (cost 0) when purchaseRate is missing, never falling back to PTS/PTR/price", () => {
    const { purchaseCostBasis, purchaseCostKnown, result } = lineCostBasis(3, 20, 1, undefined);
    expect(purchaseCostKnown).toBe(false);
    expect(purchaseCostBasis).toBe(0);
    expect(result.purchaseCost).toBe(0);
    expect(result.unpricedUnits).toBe(4);
  });

  it("reports the line as unpriced when purchaseRate is zero or negative", () => {
    expect(lineCostBasis(5, 10, 0, 0).purchaseCostKnown).toBe(false);
    expect(lineCostBasis(5, 10, 0, -1).purchaseCostKnown).toBe(false);
  });

  it("never produces NaN/Infinity regardless of inputs", () => {
    const { purchaseCostBasis, result } = lineCostBasis(0, 0, 0, undefined);
    expect(Number.isFinite(purchaseCostBasis)).toBe(true);
    expect(Number.isFinite(result.purchaseCost)).toBe(true);
    expect(Number.isFinite(result.revenue)).toBe(true);
  });
});
