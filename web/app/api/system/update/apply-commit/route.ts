import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function applySpecificCommit(req: AuthedRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const commitRef = String(body?.commitRef || "origin/main").trim();

    if (!commitRef) {
      return badRequest("commitRef is required.");
    }

    const result = await SoftwareUpdateAgentsService.applySpecificCommit(commitRef);
    return ok({ result });
  } catch (err: unknown) {
    console.error("[POST /api/system/update/apply-commit]", err);
    const msg = err instanceof Error ? err.message : "Failed to apply commit";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(applySpecificCommit, [Role.ADMIN]);
