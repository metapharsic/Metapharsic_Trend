import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, badRequest } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mrId = searchParams.get("mrId"); // User ID of MR
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return badRequest("month must be YYYY-MM");

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    let employeeId: string | undefined;
    if (mrId) {
      const employee = await db.employee.findUnique({ where: { userId: mrId } });
      if (!employee) return badRequest("MR not found");
      employeeId = employee.id;
    }

    const visits = await db.visit.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        createdAt: { gte: start, lt: end },
      },
      select: { createdAt: true, employeeId: true, employee: { select: { firstName: true, lastName: true } } },
    });

    const counts: Record<string, number> = {};
    const byMr: Record<string, { name: string; total: number }> = {};
    for (const v of visits) {
      const day = v.createdAt.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;
      const name = `${v.employee.firstName} ${v.employee.lastName}`;
      if (!byMr[v.employeeId]) byMr[v.employeeId] = { name, total: 0 };
      byMr[v.employeeId].total += 1;
    }

    return ok({ counts, byMr, total: visits.length });
  } catch (err) {
    console.error("[GET /api/manager/visits/summary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch call summary", 500);
  }
}

export const GET = withAuth(handler, [Role.ASM, Role.ADMIN, Role.MD]);
