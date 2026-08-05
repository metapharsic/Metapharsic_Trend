import { PrismaClient } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, forbidden, notFound, apiError } from "@/lib/api-response";
import { photoUrl } from "@/lib/upload";

const db = new PrismaClient();

async function handler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const visit = await db.visit.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, userId: true } },
        doctor: { select: { id: true, fullName: true, clinicAddress: true } },
        chemist: { select: { id: true, name: true, address: true } },
      },
    });

    if (!visit) return notFound("Visit not found");

    // MRs can only view their own visits
    if (visit.employee?.userId !== req.user.sub) return forbidden();

    return ok({
      visit: {
        ...visit,
        photoUrl: visit.photoPath ? photoUrl(visit.photoPath) : null,
      },
    });
  } catch (err) {
    console.error("[GET /api/mr/visits/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch visit", 500);
  }
}

export const GET = withAuth(handler, "MR");
