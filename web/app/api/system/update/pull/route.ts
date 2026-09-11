import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function pullUpdates(req: AuthedRequest) {
  try {
    let branch = "main";
    let autoSync = false;
    try {
      const body = await req.json();
      if (body?.branch) branch = String(body.branch);
      if (body?.autoSync !== undefined) autoSync = Boolean(body.autoSync);
    } catch {
      // Body may be empty
    }

    const result = await SoftwareUpdateAgentsService.pullUpdates({
      branch,
      isAuto: false,
      autoSync,
    });
    return ok({ result });
  } catch (err: unknown) {
    console.error("[POST /api/system/update/pull]", err);
    const msg = err instanceof Error ? err.message : "Failed to pull updates from GitHub";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(pullUpdates, [Role.ADMIN]);
