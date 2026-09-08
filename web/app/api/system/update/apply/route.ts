import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function applyUpdate(req: AuthedRequest) {
  try {
    const result = await SoftwareUpdateAgentsService.applyUpdate();
    return ok({ result });
  } catch (err: unknown) {
    console.error("[POST /api/system/update/apply]", err);
    const msg = err instanceof Error ? err.message : "Failed to apply software update";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(applyUpdate, [Role.ADMIN]);
