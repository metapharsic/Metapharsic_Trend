import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";


async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const mrId = searchParams.get("mrId") ?? undefined; // User ID of MR

    const dateFilter =
      startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {};

    const employees = await db.employee.findMany({
      where: {
        user: {
          role: Role.MR,
          isActive: true,
          ...(mrId ? { id: mrId } : {}),
        },
      },
      include: {
        user: { select: { id: true } },
        territories: { select: { name: true } },
      },
    });

    const performance = await Promise.all(
      employees.map(async (emp) => {
        const visitWhere = { employeeId: emp.id, ...dateFilter };

        const [totalVisits, anomalyCount, doctorsVisited, chemistsVisited, receptivenessGroups] =
          await Promise.all([
            db.visit.count({ where: visitWhere }),
            db.visit.count({ where: { ...visitWhere, anomalyFlag: true } }),
            db.visit.groupBy({ by: ["doctorId"], where: { ...visitWhere, doctorId: { not: null } } }),
            db.visit.groupBy({ by: ["chemistId"], where: { ...visitWhere, chemistId: { not: null } } }),
            db.visit.groupBy({
              by: ["receptiveness"],
              where: { ...visitWhere, receptiveness: { not: null } },
              _count: { receptiveness: true },
            }),
          ]);

        const uniqueEntities = doctorsVisited.length + chemistsVisited.length;

        // Calculate working days in range (approximate)
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        const workingDays = Math.round(daysDiff * (5 / 7));

        const receptivenessBreakdown = Object.fromEntries(
          receptivenessGroups.map((r) => [r.receptiveness, r._count.receptiveness])
        );

        return {
          mr: {
            id: emp.user.id,
            name: `${emp.firstName} ${emp.lastName}`,
            territory: emp.territories[0]?.name || "Unassigned",
          },
          metrics: {
            totalVisits,
            avgVisitsPerDay:
              totalVisits > 0 ? Math.round((totalVisits / workingDays) * 10) / 10 : 0,
            uniqueEntities,
            anomalyRate: totalVisits > 0 ? Math.round((anomalyCount / totalVisits) * 1000) / 1000 : 0,
            anomalyCount,
            receptivenessBreakdown,
          },
        };
      })
    );

    return ok({ performance });
  } catch (err) {
    console.error("[GET /api/manager/analytics/mr-performance]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch performance data", 500);
  }
}

export const GET = withAuth(handler, [Role.ASM, Role.ADMIN, Role.MD]);
