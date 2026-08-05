import { NextRequest } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { photoUrl } from "@/lib/upload";

const db = new PrismaClient();

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mrId = searchParams.get("mrId") ?? undefined; // User ID of MR
    const doctorId = searchParams.get("doctorId") ?? undefined;
    const chemistId = searchParams.get("chemistId") ?? undefined;
    const territoryId = searchParams.get("territoryId") ?? undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const anomalyFlag = searchParams.get("anomalyFlag");
    const receptiveness = searchParams.get("receptiveness") ?? undefined;

    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 50,
    });

    let employeeId: string | undefined = undefined;
    if (mrId) {
      const employee = await db.employee.findUnique({ where: { userId: mrId } });
      if (employee) {
        employeeId = employee.id;
      }
    }

    const where = {
      ...(employeeId ? { employeeId } : {}),
      ...(doctorId ? { doctorId } : {}),
      ...(chemistId ? { chemistId } : {}),
      ...(territoryId ? { employee: { territories: { some: { id: territoryId } } } } : {}),
      ...(anomalyFlag !== null ? { anomalyFlag: anomalyFlag === "true" } : {}),
      ...(receptiveness ? { receptiveness } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [visits, total] = await Promise.all([
      db.visit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { id: true, fullName: true, clinicAddress: true } },
          chemist: { select: { id: true, name: true, address: true } },
        },
      }),
      db.visit.count({ where }),
    ]);

    return ok({
      visits: visits.map((v) => ({
        ...v,
        photoUrl: v.photoPath ? photoUrl(v.photoPath) : null,
        mrName: `${v.employee.firstName} ${v.employee.lastName}`,
        entityName: v.doctor?.fullName || v.chemist?.name || "Unknown Entity",
        entityType: v.doctor ? "DOCTOR" : "CHEMIST",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/manager/visits]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch visits", 500);
  }
}

export const GET = withAuth(handler, [Role.ASM, Role.ADMIN]);
