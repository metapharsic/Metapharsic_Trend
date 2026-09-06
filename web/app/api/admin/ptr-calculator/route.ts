import { NextRequest } from "next/server";
import { ok, apiError } from "@/lib/api-response";
import { CommercialAgentsService } from "@/services/commercial-agents.service";

/**
 * GET /api/admin/ptr-calculator
 * Fetches 100% live database invoices, inventory, doctors, chemists, and MRs
 */
export async function GET(req: NextRequest) {
  try {
    const result = await CommercialAgentsService.executePipeline();
    return ok(result);
  } catch (err: any) {
    console.error("[GET /api/admin/ptr-calculator]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to execute commercial calculator", 500);
  }
}

/**
 * POST /api/admin/ptr-calculator
 * Accepts dynamic simulation inputs and returns 100% reconciled live database intelligence + simulation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await CommercialAgentsService.executePipeline(body);
    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/admin/ptr-calculator]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to process commercial data", 500);
  }
}
