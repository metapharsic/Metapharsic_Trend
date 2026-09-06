import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ok, apiError } from "@/lib/api-response";
import { CommercialAgentsService } from "@/services/commercial-agents.service";
import { extractBearerToken, verifyAccessToken, JWTPayload } from "@/lib/auth";

function resolveUser(req: NextRequest): JWTPayload | null {
  try {
    const authHeader = req.headers.get("authorization");
    const token =
      extractBearerToken(authHeader) ||
      req.cookies.get("accessToken")?.value ||
      req.cookies.get("token")?.value;

    if (token) {
      return verifyAccessToken(token);
    }
  } catch (err) {
    // Non-fatal token parse issue
  }
  return null;
}

/**
 * GET /api/admin/ptr-calculator
 * Fetches 100% live database invoices, inventory, doctors, chemists, and MRs
 */
export async function GET(req: NextRequest) {
  try {
    const user = resolveUser(req);
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
    const user = resolveUser(req);
    const body = await req.json().catch(() => ({}));
    const result = await CommercialAgentsService.executePipeline(body);
    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/admin/ptr-calculator]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to process commercial data", 500);
  }
}
