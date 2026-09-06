import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

async function updateTourPlanDay(req: AuthedRequest) {
  try {
    const body = await req.json();
    const { tourPlanId, dayId, date, territoryId, plannedDoctorId } = body;

    if (!tourPlanId) return badRequest("tourPlanId is required");
    if (!territoryId) return badRequest("territoryId is required");

    const parsedDate = date ? new Date(date) : undefined;

    const evaluation = await TourPlanAgentsService.updateDayEntry({
      tourPlanId,
      dayId,
      date: parsedDate,
      territoryId,
      plannedDoctorId: plannedDoctorId || null,
    });

    return ok({
      success: true,
      evaluation,
    });
  } catch (err: unknown) {
    console.error("[POST /api/sfa/tour-plan/update-day]", err);
    const msg = err instanceof Error ? err.message : "Failed to update daily tour plan entry";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(updateTourPlanDay, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
export const PUT = withAuth(updateTourPlanDay, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
