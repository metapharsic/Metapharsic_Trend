import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { CreditAgentsService } from "@/services/credit-agents.service";

async function reverseCollection(req: AuthedRequest) {
  try {
    const body = await req.json();
    const { collectionId, reason } = body;

    if (!collectionId || typeof collectionId !== "string") {
      return badRequest("Collection ID is required for payment retrieval.");
    }

    const result = await CreditAgentsService.reversePaymentCollection({
      collectionId,
      reason: reason ? String(reason).trim() : "Payment recorded by mistake",
      userId: req.user.sub,
    });

    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/mr/collections/reverse]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to reverse payment collection", 500);
  }
}

export const POST = withAuth(reverseCollection, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.FINANCE,
  Role.MR,
]);
