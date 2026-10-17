import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

async function handleToggleVisit(req: AuthedRequest) {
  try {
    const body = await req.json();
    const { dayId, status, notes, medicinePlacement } = body;

    if (!dayId || !status) {
      return badRequest("Missing required parameters: dayId, status");
    }

    if (!["DONE", "NOT_DONE", "PENDING"].includes(status)) {
      return badRequest("Invalid status. Expected DONE, NOT_DONE, or PENDING");
    }

    const result = await TourPlanAgentsService.toggleVisitStatus({
      dayId,
      status,
      notes,
      medicinePlacement,
    });

    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/sfa/tour-plan/toggle-visit]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to update visit status", 500);
  }
}

export const POST = withAuth(handleToggleVisit, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.RM,
  Role.ZSM,
  Role.NSM,
]);
