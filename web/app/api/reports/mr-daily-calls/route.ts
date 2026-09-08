import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { MrDailyCallsAgentsService } from "@/services/mr-daily-calls-agents.service";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mrId = searchParams.get("mrId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const search = searchParams.get("search") ?? "";

    // Date range: default to last 7 days UTC if not provided
    const now = new Date();
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const defaultStart = new Date(defaultEnd.getTime() - 7 * 86400000);

    const startDate = startDateParam ? new Date(`${startDateParam}T00:00:00.000Z`) : defaultStart;
    const endDate = endDateParam ? new Date(`${endDateParam}T23:59:59.999Z`) : defaultEnd;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return badRequest("Invalid date format. Use YYYY-MM-DD.");
    }

    // Role scoping: MR sees only their own data
    const isSelfOnly = req.user.role === Role.MR;
    let scopeEmployeeId: string | undefined;

    if (isSelfOnly) {
      const emp = await db.employee.findUnique({
        where: { userId: req.user.sub },
        select: { id: true },
      });
      if (!emp) return badRequest("Employee record not found for MR user.");
      scopeEmployeeId = emp.id;
    } else if (mrId) {
      scopeEmployeeId = mrId;
    }

    // Execute Multi-Agent Council Report Generation Engine
    const reportData = await MrDailyCallsAgentsService.generateReport({
      startDate,
      endDate,
      scopeEmployeeId,
      search,
      userRole: req.user.role,
      userId: req.user.sub,
    });

    return ok(reportData);
  } catch (err) {
    console.error("[GET /api/reports/mr-daily-calls]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to generate MR daily calls report", 500);
  }
}

export const GET = withAuth(handler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
]);
