import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { UserProvisioningAgentsService } from "@/services/user-provisioning-agents.service";

async function getOrganizationAudit(req: AuthedRequest) {
  try {
    const audit = await UserProvisioningAgentsService.auditOrganization();
    return ok({ audit });
  } catch (err: any) {
    console.error("[GET /api/admin/users/audit]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to run user organization audit", 500);
  }
}

export const GET = withAuth(getOrganizationAudit, [Role.ADMIN, Role.MD, Role.HR]);
