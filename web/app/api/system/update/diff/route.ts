import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function getUpdateDiff(req: AuthedRequest) {
  try {
    const diffReview = await SoftwareUpdateAgentsService.getUpdateDiffReview();
    return ok({ diffReview });
  } catch (err: unknown) {
    console.error("[GET /api/system/update/diff]", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch update diff review";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const GET = withAuth(getUpdateDiff, [Role.ADMIN, Role.MD, Role.ASM, Role.MR]);
