import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function getSyncStatus(req: AuthedRequest) {
  try {
    const status = await SoftwareUpdateAgentsService.getSyncStatus();
    return ok({ status });
  } catch (err: unknown) {
    console.error("[GET /api/system/sync/status]", err);
    const msg = err instanceof Error ? err.message : "Failed to retrieve sync status";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const GET = withAuth(getSyncStatus, [Role.ADMIN]);

