import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { DashboardService } from "@/services/dashboard.service";

/**
 * Org-wide KPI overview — direct database calculations with UTC normalization.
 */
async function getAdminKpis(_req: AuthedRequest) {
  try {
    const kpis = await DashboardService.calculateAdminKpis();
    return ok(kpis);
  } catch (err) {
    console.error("[GET /api/manager/dashboard/admin-kpis]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch admin KPIs", 500);
  }
}

export const GET = withAuth(getAdminKpis, [Role.ADMIN, Role.MD]);
