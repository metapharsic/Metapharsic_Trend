import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function checkUpdate(req: AuthedRequest) {
  try {
    const updateStatus = await SoftwareUpdateAgentsService.checkForUpdates();
    return ok({ updateStatus });
  } catch (err: unknown) {
    console.error("[GET /api/system/update/check]", err);
    const msg = err instanceof Error ? err.message : "Failed to check for updates";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const GET = withAuth(checkUpdate, [Role.ADMIN, Role.MD, Role.ASM, Role.MR]);
