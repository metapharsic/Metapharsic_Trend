import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

async function handleGetWhatsAppVote(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tourPlanId = searchParams.get("tourPlanId");

    if (!tourPlanId) {
      return badRequest("Missing required query parameter: tourPlanId");
    }

    const evaluation = await TourPlanAgentsService.evaluatePlan(tourPlanId);
    if (evaluation.status !== "APPROVED") {
      return badRequest("Tour Plan must be approved before dispatching to Metapharsic-MR Group");
    }

    const message = await TourPlanAgentsService.generateWhatsAppVoteMessage(tourPlanId);
    const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    return ok({
      tourPlanId,
      groupName: "Metapharsic-MR Group",
      isApproved: true,
      message,
      shareUrl,
    });
  } catch (err: any) {
    console.error("[GET /api/sfa/tour-plan/whatsapp-vote]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to generate Metapharsic-MR Group message", 500);
  }
}

async function handlePostWhatsAppVote(req: AuthedRequest) {
  try {
    const body = await req.json();
    const tourPlanId = body.tourPlanId;

    if (!tourPlanId) {
      return badRequest("Missing required body parameter: tourPlanId");
    }

    const evaluation = await TourPlanAgentsService.evaluatePlan(tourPlanId);
    if (evaluation.status !== "APPROVED") {
      return badRequest("Tour Plan must be approved before dispatching to Metapharsic-MR Group");
    }

    const dispatchResult = await TourPlanAgentsService.notifyAndDispatchWhatsAppVote(tourPlanId);
    const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(dispatchResult.whatsappMessage)}`;

    return ok({
      tourPlanId,
      groupName: "Metapharsic-MR Group",
      isApproved: true,
      whatsappMessage: dispatchResult.whatsappMessage,
      adminsNotified: dispatchResult.adminsNotified,
      mrNotified: dispatchResult.mrNotified,
      shareUrl,
    });
  } catch (err: any) {
    console.error("[POST /api/sfa/tour-plan/whatsapp-vote]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to dispatch to Metapharsic-MR Group", 500);
  }
}

export const GET = withAuth(handleGetWhatsAppVote, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
export const POST = withAuth(handlePostWhatsAppVote, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
