import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { NearbyChemistAgentsService } from "@/services/nearby-chemist-agents.service";

async function getNearbyChemists(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");
    const territoryId = searchParams.get("territoryId");
    const latStr = searchParams.get("latitude");
    const lonStr = searchParams.get("longitude");
    const limitStr = searchParams.get("limit");

    const latitude = latStr ? parseFloat(latStr) : null;
    const longitude = lonStr ? parseFloat(lonStr) : null;
    const limit = limitStr ? parseInt(limitStr, 10) : 15;

    const result = await NearbyChemistAgentsService.getNearbyChemistsForDoctor({
      doctorId: doctorId || null,
      territoryId: territoryId || null,
      latitude,
      longitude,
      limit,
    });

    return ok(result);
  } catch (err: any) {
    console.error("[GET /api/mr/nearby-chemists]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch nearby chemists", 500);
  }
}

export const GET = withAuth(getNearbyChemists, [
  Role.MR,
  Role.ASM,
  Role.RM,
  Role.ZSM,
  Role.NSM,
  Role.MD,
  Role.ADMIN,
]);
