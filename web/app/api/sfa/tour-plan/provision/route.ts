import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

async function provisionTourPlan(req: AuthedRequest) {
  try {
    let { employeeId, month, overwrite } = await req.json().catch(() => ({}));

    if (!employeeId) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) {
        const fallbackEmp = await db.employee.findFirst();
        if (!fallbackEmp) return unauthorized("Employee record not found");
        employeeId = fallbackEmp.id;
      } else {
        employeeId = employee.id;
      }
    }

    const targetMonth = month ? new Date(`${month}-01`) : new Date();

    const evaluation = await TourPlanAgentsService.provisionMonthlyPlan({
      employeeId,
      month: targetMonth,
      overwrite: Boolean(overwrite),
    });

    return ok({
      tourPlanId: evaluation.id,
      status: evaluation.status,
      evaluation,
    });
  } catch (err: unknown) {
    console.error("[POST /api/sfa/tour-plan/provision]", err);
    const msg = err instanceof Error ? err.message : "Failed to provision tour plan";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(provisionTourPlan, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
