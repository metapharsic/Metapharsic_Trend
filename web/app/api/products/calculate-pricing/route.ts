import { NextRequest } from "next/server";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { ProductPricingAgentsService } from "@/services/product-pricing-agents.service";

/**
 * POST /api/products/calculate-pricing
 * Fast, stateless commercial pricing calculation and multi-agent compliance validation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = ProductPricingAgentsService.calculatePricing({
      mrp: Number(body.mrp) || 0,
      ptr: body.ptr != null ? Number(body.ptr) : undefined,
      pts: body.pts != null ? Number(body.pts) : undefined,
      purchaseRate: body.purchaseRate != null ? Number(body.purchaseRate) : undefined,
      chemistMarginPct: body.chemistMarginPct != null ? Number(body.chemistMarginPct) : undefined,
      stockistMarginPct: body.stockistMarginPct != null ? Number(body.stockistMarginPct) : undefined,
      companyMarginPct: body.companyMarginPct != null ? Number(body.companyMarginPct) : undefined,
      autoCalculate: body.autoCalculate !== false,
      anchorMode: body.anchorMode,
    });

    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/products/calculate-pricing]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to calculate product pricing", 500);
  }
}
