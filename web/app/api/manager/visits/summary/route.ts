import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, badRequest } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mrId = searchParams.get("mrId"); // User ID or Employee ID of MR
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return badRequest("month must be YYYY-MM");

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    let employeeId: string | undefined;
    if (mrId) {
      const employee = await db.employee.findFirst({
        where: {
          OR: [
            { userId: mrId },
            { id: mrId },
          ],
        },
        select: { id: true, userId: true },
      });
      if (!employee) return badRequest("MR not found");
      employeeId = employee.id;
    }

    const visits = await db.visit.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        createdAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        createdAt: true,
        employeeId: true,
        purpose: true,
        feedback: true,
        receptiveness: true,
        durationMinutes: true,
        employee: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            user: { select: { id: true, email: true } },
          },
        },
        doctor: { select: { fullName: true } },
        chemist: { select: { name: true } },
        hospital: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const counts: Record<string, number> = {};
    const byMr: Record<string, { name: string; userId: string; employeeId: string; total: number }> = {};
    const byDay: Record<string, any[]> = {};

    for (const v of visits) {
      const day = v.createdAt.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;

      const name = v.employee
        ? `${v.employee.firstName || ""} ${v.employee.lastName || ""}`.trim() || "Unknown MR"
        : "Unknown MR";
      const uId = v.employee?.user?.id || v.employee?.userId || v.employeeId;
      const eId = v.employeeId;

      if (!byMr[uId]) {
        byMr[uId] = { name, userId: uId, employeeId: eId, total: 0 };
      }
      byMr[uId].total += 1;

      // Keep employeeId key aligned to avoid lookups failing if frontend references employeeId
      if (eId !== uId && !byMr[eId]) {
        byMr[eId] = byMr[uId];
      }

      if (!byDay[day]) byDay[day] = [];
      byDay[day].push({
        id: v.id,
        time: v.createdAt.toISOString(),
        mrName: name,
        mrUserId: uId,
        mrEmployeeId: eId,
        target: v.doctor?.fullName || v.chemist?.name || v.hospital?.name || "—",
        targetType: v.doctor ? "Doctor" : v.chemist ? "Chemist" : v.hospital ? "Hospital" : "Other",
        purpose: v.purpose,
        feedback: v.feedback,
        receptiveness: v.receptiveness,
        durationMinutes: v.durationMinutes,
      });
    }

    // Query available months with counts to power instant month switching
    let availableMonths: Array<{ month: string; count: number }> = [];
    try {
      availableMonths = await db.$queryRaw<Array<{ month: string; count: number }>>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM "Visit"
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 24;
      `;
    } catch {
      availableMonths = [];
    }

    return ok({
      counts,
      byMr,
      byDay,
      total: visits.length,
      availableMonths,
      selectedMonth: month,
    });
  } catch (err) {
    console.error("[GET /api/manager/visits/summary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch call summary", 500);
  }
}

export const GET = withAuth(handler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
]);

