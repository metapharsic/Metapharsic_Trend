import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function fetchSpecificCommit(req: AuthedRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const commitRef = String(body?.commitRef || "origin/main").trim();

    if (!commitRef) {
      return badRequest("commitRef is required (e.g. hash, branch, or tag).");
    }

    const result = await SoftwareUpdateAgentsService.fetchCommitForcefully(commitRef);
    return ok({ result });
  } catch (err: unknown) {
    console.error("[POST /api/system/update/fetch-commit]", err);
    const msg = err instanceof Error ? err.message : "Failed to force-fetch commit from GitHub";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(fetchSpecificCommit, [Role.ADMIN]);
