import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { ok, apiError } from "@/lib/api-response";

async function handler(_req: AuthedRequest) {
  try {
    const settings = await getWorkflowSettings();
    return ok({
      requirePhoto: settings.requirePhoto,
      geofenceRadiusMeters: settings.geofenceRadiusMeters,
      gpsAccuracyWarnMeters: settings.gpsAccuracyWarnMeters,
    });
  } catch (err) {
    console.error("[GET /api/mr/workflow-settings]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch workflow settings", 500);
  }
}

export const GET = withAuth(handler, [Role.MR]);
