import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

async function provisionTourPlan(req: AuthedRequest) {
  try {
    let { employeeId, month, overwrite, provisionAll } = await req.json().catch(() => ({}));
    const targetMonth = month ? new Date(`${month}-01`) : new Date();

    if (provisionAll) {
      const mrEmployees = await db.employee.findMany({
        where: { user: { role: Role.MR, isActive: true } },
      });

      const evaluations = [];
      for (const emp of mrEmployees) {
        try {
          const evalRes = await TourPlanAgentsService.provisionMonthlyPlan({
            employeeId: emp.id,
            month: targetMonth,
            overwrite: Boolean(overwrite),
          });
          evaluations.push(evalRes);
        } catch (provErr) {
          console.warn(`[Auto-Provision] Skipping ${emp.id}:`, provErr);
        }
      }

      return ok({
        provisionedCount: evaluations.length,
        evaluations,
      });
    }

    if (!employeeId) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) {
        const fallbackEmp = await db.employee.findFirst({ where: { user: { role: Role.MR } } });
        if (!fallbackEmp) return unauthorized("Employee record not found");
        employeeId = fallbackEmp.id;
      } else {
        employeeId = employee.id;
      }
    }

    const evaluation = await TourPlanAgentsService.provisionMonthlyPlan({
      employeeId,
      month: targetMonth,
      overwrite: Boolean(overwrite),
    });

    // Dispatch WhatsApp vote update and notifications to Admin and MR
    const dispatchResult = await TourPlanAgentsService.notifyAndDispatchWhatsAppVote(evaluation.id);

    return ok({
      tourPlanId: evaluation.id,
      status: evaluation.status,
      evaluation,
      whatsappMessage: dispatchResult.whatsappMessage,
      adminsNotified: dispatchResult.adminsNotified,
      mrNotified: dispatchResult.mrNotified,
    });
  } catch (err: unknown) {
    console.error("[POST /api/sfa/tour-plan/provision]", err);
    const msg = err instanceof Error ? err.message : "Failed to provision tour plan";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(provisionTourPlan, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
