import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

async function fetchCommits(req: AuthedRequest) {
  try {
    let branch = "main";
    try {
      const body = await req.json();
      if (body?.branch) branch = String(body.branch);
    } catch {
      // Body may be empty on POST
    }

    const result = await SoftwareUpdateAgentsService.fetchRemoteCommits(branch);
    return ok(result);
  } catch (err: unknown) {
    console.error("[POST /api/system/update/fetch]", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch remote commits from GitHub";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(fetchCommits, [Role.ADMIN]);
