import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

async function getTerritories(req: AuthedRequest) {
  try {
    const territories = await db.territory.findMany({
      orderBy: [{ region: "asc" }, { name: "asc" }],
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true, role: true } },
          },
        },
        _count: {
          select: {
            doctors: true,
            chemists: true,
            hospitals: true,
          },
        },
      },
    });

    return ok({ territories });
  } catch (err) {
    console.error("[GET /api/territories]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch territories", 500);
  }
}

export const GET = withAuth(getTerritories);
