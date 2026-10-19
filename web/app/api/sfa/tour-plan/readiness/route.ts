import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError, unauthorized } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

/**
 * GET /api/sfa/tour-plan/readiness
 * Checks whether the MR has created a schedule for today (or the target date).
 * Prompts reminder if missing so MR is notified upon logging in before going on field.
 */
async function checkTourPlanReadiness(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    let employeeId = searchParams.get("employeeId");

    const role = req.user.role as Role;
    const isManager = role === Role.ADMIN || role === Role.MD || role === Role.ASM || role === Role.RM || role === Role.ZSM || role === Role.NSM;

    if (!employeeId || !isManager) {
      const emp = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!emp) {
        return unauthorized("Employee record not found for logged in user");
      }
      employeeId = emp.id;
    }

    const readiness = await TourPlanAgentsService.checkFieldReadiness({
      employeeId,
      date: dateParam || undefined,
    });

    return ok(readiness);
  } catch (err: unknown) {
    console.error("[GET /api/sfa/tour-plan/readiness]", err);
    const msg = err instanceof Error ? err.message : "Failed to check tour plan readiness";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const GET = withAuth(checkTourPlanReadiness, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.RM,
  Role.ZSM,
  Role.NSM,
]);
