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

    const records = await db.attendance.findMany({
      where: { employeeId: employee.id, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });

    let totalMinutes = 0;
    const days = records.map((r) => {
      const minutes = r.checkOut ? Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 60000) : null;
      if (minutes) totalMinutes += minutes;
      return {
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        minutes,
        latitude: r.latitude,
        longitude: r.longitude,
      };
    });

    return ok({ days, totalMinutes, daysPresent: records.filter((r) => r.status === "PRESENT").length });
  } catch (err) {
    console.error("[GET /api/mr/attendance/history]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch attendance history", 500);
  }
}

export const GET = withAuth(handler, [Role.MR]);
