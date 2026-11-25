import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { ChemistDoctorTaggingService } from "@/services/chemist-doctor-tagging.service";

async function getPrescribedDoctors(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chemistId = searchParams.get("chemistId");

    if (!chemistId) {
      return badRequest("Missing chemistId query parameter");
    }

    const result = await ChemistDoctorTaggingService.getPrescribedDoctorsForChemist(chemistId);
    return ok({ data: result });
  } catch (err: unknown) {
    console.error("[GET /api/chemists/prescribed-doctors]", err);
    const message = err instanceof Error ? err.message : "Failed to load prescribed doctors";
    return apiError("INTERNAL_SERVER_ERROR", message, 500);
  }
}

export const GET = withAuth(getPrescribedDoctors, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
  Role.FINANCE,
  Role.WAREHOUSE,
]);
