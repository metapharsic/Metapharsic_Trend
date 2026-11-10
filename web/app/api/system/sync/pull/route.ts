import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function pullDataSync(req: AuthedRequest) {
  try {
    const result = await SoftwareUpdateAgentsService.oneClickGetDataSync();
    return ok({ result });
  } catch (err: unknown) {
    console.error("[POST /api/system/sync/pull]", err);
    const msg = err instanceof Error ? err.message : "Failed to execute one-click get data sync";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(pullDataSync, [Role.ADMIN]);

