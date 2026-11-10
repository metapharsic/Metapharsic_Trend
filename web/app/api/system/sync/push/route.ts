import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function pushData(req: AuthedRequest) {
  try {
    let commitMessage: string | undefined;
    try {
      const body = await req.json();
      if (body?.commitMessage && typeof body.commitMessage === "string") {
        commitMessage = body.commitMessage.trim();
      }
    } catch {
      // Body may be empty
    }

    const result = await SoftwareUpdateAgentsService.oneClickPushData(commitMessage);
    return ok({ result });
  } catch (err: unknown) {
    console.error("[POST /api/system/sync/push]", err);
    const msg = err instanceof Error ? err.message : "Failed to execute one-click push";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(pushData, [Role.ADMIN]);

