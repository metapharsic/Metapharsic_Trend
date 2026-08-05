import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError, badRequest } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return badRequest("month must be YYYY-MM");

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const visits = await db.visit.findMany({
      where: { employeeId: employee.id, createdAt: { gte: start, lt: end } },
      select: { createdAt: true },
    });

    const counts: Record<string, number> = {};
    for (const v of visits) {
      const day = v.createdAt.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;
    }

    return ok({ counts, total: visits.length });
  } catch (err) {
    console.error("[GET /api/mr/visits/summary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch call summary", 500);
  }
}

export const GET = withAuth(handler, [Role.MR]);
