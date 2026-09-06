import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { CommercialAgentsService } from "@/services/commercial-agents.service";

/**
 * GET /api/admin/ptr-calculator
 * Fetches 100% live database invoices, inventory, doctors, chemists, and MRs
 */
async function getPtrCalculator(req: AuthedRequest) {
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
async function postPtrCalculator(req: AuthedRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await CommercialAgentsService.executePipeline(body);
    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/admin/ptr-calculator]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to process commercial data", 500);
  }
}

export const GET = withAuth(getPtrCalculator);
export const POST = withAuth(postPtrCalculator);
