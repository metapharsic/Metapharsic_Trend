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

    // Merge and return all active territories for all users so any MR can pick any area
    const allTerritories = await db.territory.findMany({
      select: {
        id: true,
        name: true,
        region: true,
        zone: true,
        _count: { select: { doctors: true, chemists: true } },
      },
      orderBy: { name: "asc" },
    });

    return ok({
      territories: allTerritories,
      assignedTerritories: employee?.territories ?? [],
    });
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
