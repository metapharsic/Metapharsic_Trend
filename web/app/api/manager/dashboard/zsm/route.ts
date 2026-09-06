import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { DashboardService } from "@/services/dashboard.service";

/**
 * Zonal Sales Manager (ZSM) regional overview.
 * Direct calculations with genuine regional rollups, call compliance, and anomalies.
 */
async function getZsmDashboard(_req: AuthedRequest) {
  try {
    const data = await DashboardService.calculateZsmDashboard();
    return ok(data);
  } catch (err) {
    console.error("[GET /api/manager/dashboard/zsm]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch ZSM dashboard data", 500);
  }
}

export const GET = withAuth(getZsmDashboard, [Role.ZSM, Role.NSM, Role.MD, Role.ADMIN]);
