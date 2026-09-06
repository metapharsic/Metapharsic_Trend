import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { DashboardService } from "@/services/dashboard.service";

/**
 * National Sales Manager (NSM) dashboard.
 * Direct calculations for live zonal performance, national KPIs, and brand market share.
 */
async function getNsmDashboard(_req: AuthedRequest) {
  try {
    const data = await DashboardService.calculateNsmDashboard();
    return ok(data);
  } catch (err) {
    console.error("[GET /api/manager/dashboard/nsm]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch NSM dashboard data", 500);
  }
}

export const GET = withAuth(getNsmDashboard, [Role.NSM, Role.MD, Role.ADMIN]);
