import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";


async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mrId = searchParams.get("mrId") ?? undefined; // This is the user ID of the MR
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const territoryId = searchParams.get("territoryId") ?? undefined;

    // Resolve employee if mrId is provided
    let employeeId: string | undefined = undefined;
    if (mrId) {
      const employee = await db.employee.findUnique({ where: { userId: mrId } });
      if (employee) {
        employeeId = employee.id;
      }
    }

    const visits = await db.visit.findMany({
      where: {
        locationUnavailable: false,
        latitude: { not: 0 }, // non-zero coords
        longitude: { not: 0 },
        ...(employeeId ? { employeeId } : {}),
        ...(territoryId ? { employee: { territories: { some: { id: territoryId } } } } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        anomalyFlag: true,
        receptiveness: true,
        employee: { select: { firstName: true, lastName: true } },
        doctor: { select: { fullName: true } },
        chemist: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    return ok({
      visits: visits.map((v) => ({
        id: v.id,
        latitude: v.latitude,
        longitude: v.longitude,
        timestamp: v.createdAt,
        anomalyFlag: v.anomalyFlag,
        receptiveness: v.receptiveness,
        mrName: `${v.employee.firstName} ${v.employee.lastName}`,
        entityName: v.doctor?.fullName || v.chemist?.name || "Unknown Entity",
        entityType: v.doctor ? "DOCTOR" : "CHEMIST",
      })),
    });
  } catch (err) {
    console.error("[GET /api/manager/visits/map]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch map data", 500);
  }
}

export const GET = withAuth(handler, [Role.ASM, Role.ADMIN]);
