import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, unauthorized, forbidden, apiError } from "@/lib/api-response";

/**
 * Read-only. There is no claim *creation* or approval route yet — MRs have no UI
 * to raise a return/damage claim, so `Claim` rows only exist if inserted directly.
 * This endpoint exists so a distributor can see whatever claims are on record
 * against them; building the raise/approve workflow is separate scope.
 */
async function getClaims(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedId = searchParams.get("distributorId");
    const isManager = req.user.role === Role.ADMIN || req.user.role === Role.MD;

    if (requestedId && !isManager) return forbidden("You may only view your own claims");

    const distributor = requestedId
      ? await db.distributor.findUnique({ where: { id: requestedId } })
      : (isManager
          ? await db.distributor.findFirst()
          : await db.distributor.findUnique({ where: { userId: req.user.sub } }));

    if (!distributor) {
      return requestedId
        ? notFound("Distributor not found")
        : notFound("No distributor account is linked to this login");
    }

    const claims = await db.claim.findMany({
      where: { distributorId: distributor.id },
      include: {
        chemist: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true } },
        creditNote: { select: { number: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ claims });
  } catch (err) {
    console.error("[GET /api/distributor/claims]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch claims", 500);
  }
}

export const GET = withAuth(getClaims, [Role.DISTRIBUTOR, Role.ADMIN, Role.MD]);
