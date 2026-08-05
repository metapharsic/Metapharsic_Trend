import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { ok, apiError, badRequest } from "@/lib/api-response";
import { z } from "zod";

const UpdateSchema = z.object({
  requirePhoto: z.boolean().optional(),
  enforceTourPlan: z.boolean().optional(),
  geofenceRadiusMeters: z.coerce.number().int().min(10).max(5000).optional(),
  gpsAccuracyWarnMeters: z.coerce.number().int().min(5).max(1000).optional(),
});

async function getHandler(_req: AuthedRequest) {
  try {
    const settings = await getWorkflowSettings();
    return ok({ settings });
  } catch (err) {
    console.error("[GET /api/manager/workflow-settings]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch workflow settings", 500);
  }
}

async function putHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    await getWorkflowSettings(); // ensure row exists
    const settings = await db.workflowSettings.update({
      where: { id: "singleton" },
      data: parsed.data,
    });
    return ok({ settings });
  } catch (err) {
    console.error("[PUT /api/manager/workflow-settings]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update workflow settings", 500);
  }
}

export const GET = withAuth(getHandler, [Role.ADMIN]);
export const PUT = withAuth(putHandler, [Role.ADMIN]);
