import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, apiError } from "@/lib/api-response";
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

export const GET = withAuth(getTourPlanById, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
