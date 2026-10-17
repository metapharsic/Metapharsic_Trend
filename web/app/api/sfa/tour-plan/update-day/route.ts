import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

async function updateTourPlanDay(req: AuthedRequest) {
  try {
    let body: any = {};
    if (req.method !== "DELETE" || req.headers.get("content-type")?.includes("json")) {
      try {
        body = await req.json();
      } catch {}
    }

    const { searchParams } = new URL(req.url);
    const tourPlanId = body.tourPlanId || searchParams.get("tourPlanId");
    const dayId = body.dayId || searchParams.get("dayId");
    const action = body.action || (req.method === "DELETE" ? "delete" : "edit");
    const { date, territoryId, entityType, plannedDoctorId, plannedChemistId, beatName, subArea, notes } = body;

    if (!tourPlanId) return badRequest("tourPlanId is required");

    const plan = await db.tourPlan.findUnique({
      where: { id: tourPlanId },
      select: { id: true, status: true },
    });

    if (!plan) {
      return badRequest("Tour plan not found");
    }

    if (action === "delete" || req.method === "DELETE") {
      if (!dayId) return badRequest("dayId is required to delete day");
      const result = await TourPlanAgentsService.deleteDayEntry({
        tourPlanId,
        dayId,
      });
      return ok({
        success: true,
        action: "deleted",
        ...result,
      });
    }

    if (action === "add") {
      if (!date) return badRequest("date is required to add day");
      if (!territoryId) return badRequest("territoryId is required to add day");
      const result = await TourPlanAgentsService.addDayEntry({
        tourPlanId,
        date,
        territoryId,
        entityType: entityType || (plannedChemistId ? "CHEMIST" : "DOCTOR"),
        plannedDoctorId: plannedDoctorId || null,
        plannedChemistId: plannedChemistId || null,
        beatName: beatName || null,
        subArea: subArea || null,
        notes: notes || null,
      });
      return ok({
        success: true,
        action: "added",
        ...result,
      });
    }

    // Default: edit existing day
    if (!territoryId) return badRequest("territoryId is required");

    const parsedDate = date ? new Date(date) : undefined;

    const evaluation = await TourPlanAgentsService.updateDayEntry({
      tourPlanId,
      dayId,
      date: parsedDate,
      territoryId,
      entityType: entityType || (plannedChemistId ? "CHEMIST" : "DOCTOR"),
      plannedDoctorId: plannedDoctorId || null,
      plannedChemistId: plannedChemistId || null,
      beatName: beatName || null,
      subArea: subArea || null,
      notes: notes || null,
    });

    return ok({
      success: true,
      action: "updated",
      evaluation,
    });
  } catch (err: unknown) {
    console.error("[/api/sfa/tour-plan/update-day]", err);
    const msg = err instanceof Error ? err.message : "Failed to update daily tour plan entry";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(updateTourPlanDay, [Role.MR, Role.ASM, Role.ADMIN, Role.MD, Role.RM, Role.ZSM, Role.NSM]);
export const PUT = withAuth(updateTourPlanDay, [Role.MR, Role.ASM, Role.ADMIN, Role.MD, Role.RM, Role.ZSM, Role.NSM]);
export const DELETE = withAuth(updateTourPlanDay, [Role.MR, Role.ASM, Role.ADMIN, Role.MD, Role.RM, Role.ZSM, Role.NSM]);
