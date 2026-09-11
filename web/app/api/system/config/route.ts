import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { SystemConfigService, AutoPullSchedule } from "@/services/system-config.service";
import { reloadGitHubSyncSchedule } from "@/jobs/github-sync";
import { z } from "zod";

const UpdateConfigSchema = z.object({
  autoPullEnabled: z.boolean().optional(),
  autoPullSchedule: z.enum(["TWICE_WEEKLY", "DAILY", "OFF"]).optional(),
  autoSyncOnPull: z.boolean().optional(),
  targetBranch: z.string().min(1).optional(),
});

async function getSystemConfig(req: AuthedRequest) {
  try {
    const config = SystemConfigService.getConfig();
    const nextScheduledPull = SystemConfigService.getNextScheduledPull();
    return ok({ config, nextScheduledPull });
  } catch (err: unknown) {
    console.error("[GET /api/system/config]", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch system configuration";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

async function updateSystemConfig(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateConfigSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const updated = SystemConfigService.updateConfig(parsed.data);
    reloadGitHubSyncSchedule();
    const nextScheduledPull = SystemConfigService.getNextScheduledPull();

    return ok({ config: updated, nextScheduledPull });
  } catch (err: unknown) {
    console.error("[PUT /api/system/config]", err);
    const msg = err instanceof Error ? err.message : "Failed to update system configuration";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const GET = withAuth(getSystemConfig, [Role.ADMIN]);
export const PUT = withAuth(updateSystemConfig, [Role.ADMIN]);
