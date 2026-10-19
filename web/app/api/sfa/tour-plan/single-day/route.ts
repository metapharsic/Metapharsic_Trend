import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError, unauthorized } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

/**
 * POST /api/sfa/tour-plan/single-day
 * Creates or appends a 1-day tour plan entry clubbing doctors and chemists together.
 * Avoids default 27-day pre-filling. Allows MRs to plan or append one day at a time.
 */
async function createOrAppendSingleDayPlan(req: AuthedRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { employeeId, date, territoryId, beatName, subArea, doctorIds, chemistIds, notes } = body;

    const role = req.user.role as Role;
    const isManager = role === Role.ADMIN || role === Role.MD || role === Role.ASM || role === Role.RM || role === Role.ZSM || role === Role.NSM;

    // Resolve employeeId
    if (!employeeId || !isManager) {
      const emp = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!emp) {
        return unauthorized("Employee record not found for logged in user");
      }
      employeeId = emp.id;
    }

    if (!date) {
      return badRequest("date is required (format: YYYY-MM-DD)");
    }
    if (!territoryId) {
      return badRequest("territoryId is required");
    }

    const evaluation = await TourPlanAgentsService.createOrAppendSingleDay({
      employeeId,
      date,
      territoryId,
      beatName: beatName || null,
      subArea: subArea || null,
      doctorIds: Array.isArray(doctorIds) ? doctorIds : [],
      chemistIds: Array.isArray(chemistIds) ? chemistIds : [],
      notes: notes || null,
    });

    return ok({
      success: true,
      tourPlanId: evaluation.id,
      evaluation,
    });
  } catch (err: unknown) {
    console.error("[POST /api/sfa/tour-plan/single-day]", err);
    const msg = err instanceof Error ? err.message : "Failed to create single day schedule";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(createOrAppendSingleDayPlan, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.RM,
  Role.ZSM,
  Role.NSM,
]);
