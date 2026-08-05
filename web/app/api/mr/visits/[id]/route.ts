import { db } from "@/lib/db";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, forbidden, notFound, apiError, badRequest } from "@/lib/api-response";
import { photoUrl } from "@/lib/upload";
import { UpdateVisitSchema } from "@/lib/validators";


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
        lead: true,
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

async function updateHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const visit = await db.visit.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!visit) return notFound("Visit not found");
    if (visit.employee?.userId !== req.user.sub) return forbidden();

    const body = await req.json();
    const parsed = UpdateVisitSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const updated = await db.visit.update({ where: { id }, data: parsed.data });
    return ok({ visit: updated });
  } catch (err) {
    console.error("[PUT /api/mr/visits/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update visit", 500);
  }
}

export const GET = withAuth(handler, "MR");
export const PUT = withAuth(updateHandler, "MR");
