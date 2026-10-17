import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, forbidden, badRequest, apiError } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

async function getTourPlanById(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const evaluation = await TourPlanAgentsService.evaluatePlan(id);
    return ok({ evaluation });
  } catch (err: unknown) {
    console.error("[GET /api/sfa/tour-plan/[id]]", err);
    return notFound("Tour plan not found");
  }
}

async function deleteTourPlanById(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    if (!id) return badRequest("Tour plan ID is required");

    const result = await TourPlanAgentsService.deleteTourPlan({
      tourPlanId: id,
      requestingUserId: req.user.sub,
      requestingRole: req.user.role as Role,
    });

    return ok(result);
  } catch (err: any) {
    console.error("[DELETE /api/sfa/tour-plan/[id]]", err);
    if (err.message?.includes("not found")) {
      return notFound(err.message);
    }
    if (
      err.message?.includes("Forbidden") ||
      err.message?.includes("permission") ||
      err.message?.includes("forbidden after approval")
    ) {
      return forbidden(err.message);
    }
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to delete tour plan", 500);
  }
}

export const GET = withAuth(getTourPlanById, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
export const DELETE = withAuth(deleteTourPlanById, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
