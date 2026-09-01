import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const isManager =
      req.user.role === Role.ADMIN ||
      req.user.role === Role.ASM ||
      req.user.role === Role.RM ||
      req.user.role === Role.ZSM ||
      req.user.role === Role.NSM ||
      req.user.role === Role.MD;

    const employee = await db.employee.findUnique({
      where: { userId: req.user.sub },
      include: { territories: { select: { id: true, name: true } } },
    });

    if (employee?.territories && employee.territories.length > 0 && !isManager) {
      return ok({ territories: employee.territories });
    }

    // Fall back to all active territories if unassigned or if manager/admin
    const allTerritories = await db.territory.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return ok({ territories: allTerritories });
  } catch (err) {
    console.error("[GET /api/mr/territories]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch territories", 500);
  }
}

export const GET = withAuth(handler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.RM,
  Role.ZSM,
  Role.NSM,
  Role.MD,
]);
