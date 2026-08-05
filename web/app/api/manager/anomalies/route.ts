import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role, AnomalyReviewStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { photoUrl } from "@/lib/upload";


async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as AnomalyReviewStatus | null;
    const mrId = searchParams.get("mrId") ?? undefined; // User ID of MR
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    let employeeId: string | undefined = undefined;
    if (mrId) {
      const employee = await db.employee.findUnique({ where: { userId: mrId } });
      if (employee) {
        employeeId = employee.id;
      }
    }

    const where = {
      anomalyFlag: true,
      ...(employeeId ? { employeeId } : {}),
      ...(status
        ? { anomalyReviews: { some: { status } } }
        : { anomalyReviews: { none: {} } }),
    };

    const [visits, total] = await Promise.all([
      db.visit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              userId: true,
            },
          },
          doctor: { select: { id: true, fullName: true } },
          chemist: { select: { id: true, name: true } },
          anomalyReviews: {
            orderBy: { reviewedAt: "desc" },
            take: 1,
            include: { reviewer: { select: { email: true } } },
          },
        },
      }),
      db.visit.count({ where }),
    ]);

    return ok({
      anomalies: visits.map((v) => ({
        visit: {
          id: v.id,
          mr: {
            id: v.employee.userId,
            name: `${v.employee.firstName} ${v.employee.lastName}`,
          },
          entity: {
            id: v.doctor?.id || v.chemist?.id || "",
            name: v.doctor?.fullName || v.chemist?.name || "Unknown Entity",
            type: v.doctor ? "DOCTOR" : "CHEMIST",
          },
          timestamp: v.createdAt,
          photoUrl: v.photoPath ? photoUrl(v.photoPath) : null,
          anomalyDetails: v.anomalyDetails ? JSON.parse(v.anomalyDetails) : null,
          locationUnavailable: v.locationUnavailable,
        },
        review: v.anomalyReviews[0] ?? null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/manager/anomalies]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch anomalies", 500);
  }
}

export const GET = withAuth(handler, [Role.ASM, Role.ADMIN, Role.MD]);
