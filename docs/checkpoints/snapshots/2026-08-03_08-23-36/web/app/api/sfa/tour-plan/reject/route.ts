import { PrismaClient, Role, TourPlanStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { TourPlanDecisionSchema } from "@/lib/validators";

const db = new PrismaClient();

async function rejectTourPlan(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = TourPlanDecisionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const plan = await db.tourPlan.findUnique({ where: { id: parsed.data.tourPlanId } });
    if (!plan) return notFound("Tour plan not found");
    if (plan.status !== TourPlanStatus.PENDING_ASM) {
      return badRequest("Only tour plans pending approval can be rejected");
    }

    const updated = await db.tourPlan.update({
      where: { id: plan.id },
      data: { status: TourPlanStatus.REJECTED },
    });

    return ok({ tourPlanId: updated.id, status: updated.status });
  } catch (err) {
    console.error("[POST /api/sfa/tour-plan/reject]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to reject tour plan", 500);
  }
}

export const POST = withAuth(rejectTourPlan, [Role.ASM, Role.ADMIN]);
