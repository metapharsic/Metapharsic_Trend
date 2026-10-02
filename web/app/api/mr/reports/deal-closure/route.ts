import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError, forbidden } from "@/lib/api-response";
import { DealClosureAgentsService } from "@/services/deal-closure-agents.service";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const targetType = searchParams.get("targetType");
    const canCloseThisWeekOnly = searchParams.get("canCloseThisWeekOnly") === "true";
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;

    const isManager = ([
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
    ] as Role[]).includes(req.user.role as Role);

    let scopeEmployeeId: string | undefined;

    if (employeeId) {
      if (!isManager) {
        return forbidden("You may only view your own deal closure analysis");
      }
      const employee = await db.employee.findFirst({
        where: {
          OR: [
            { id: employeeId },
            { userId: employeeId },
          ],
        },
        select: { id: true },
      });
      scopeEmployeeId = employee?.id || employeeId;
    } else if (!isManager) {
      const emp = await db.employee.findUnique({
        where: { userId: req.user.sub },
        select: { id: true },
      });
      if (!emp) return badRequest("Employee record not found");
      scopeEmployeeId = emp.id;
    }

    const summary = await DealClosureAgentsService.analyzeDealClosures({
      employeeId: scopeEmployeeId,
      targetType: targetType || undefined,
      canCloseThisWeekOnly,
      limit,
    });

    return ok(summary);
  } catch (err) {
    console.error("[GET /api/mr/reports/deal-closure]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to analyze deal closures", 500);
  }
}

export const GET = withAuth(handler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
]);
