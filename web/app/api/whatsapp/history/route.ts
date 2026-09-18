import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { ReportsService } from "@/src/reports/reports.service";

/**
 * GET /api/whatsapp/history
 * Fetches WhatsApp dispatch audit history logs with filtering and pagination.
 */
async function getWhatsAppDispatchHistoryHandler(req: AuthedRequest) {
  try {
    const url = new URL(req.url, "http://localhost");
    const employeeIdParam = url.searchParams.get("employeeId") || undefined;
    const targetType = url.searchParams.get("targetType") || undefined;
    const period = url.searchParams.get("period") || undefined;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const isManager = ([
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
      Role.FINANCE,
    ] as Role[]).includes(req.user.role as Role);

    let effectiveEmployeeId = employeeIdParam;

    if (!isManager) {
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
      });
      if (!employee) return unauthorized("Employee record not found");
      effectiveEmployeeId = employee.id;
    }

    const historyData = await ReportsService.getWhatsAppDispatchHistory({
      employeeId: effectiveEmployeeId,
      targetType,
      period,
      startDate,
      endDate,
      page,
      limit,
    });

    return ok(historyData);
  } catch (err) {
    console.error("[GET /api/whatsapp/history]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch WhatsApp dispatch history", 500);
  }
}

export const GET = withAuth(getWhatsAppDispatchHistoryHandler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.FINANCE,
  Role.MR,
]);
