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
      orderBy: { checkIn: "asc" },
    });

    // Multiple check-in/out sessions can now exist per day — collapse them
    // into one calendar entry per date, summing minutes across sessions.
    const byDate = new Map<string, typeof records>();
    for (const r of records) {
      const key = r.date.toISOString().slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(r);
    }

    let totalMinutes = 0;
    const days = Array.from(byDate.entries())
      .map(([date, sessions]) => {
        const first = sessions[0];
        const last = sessions[sessions.length - 1];
        const dayMinutes = sessions.reduce((sum, s) => {
          if (!s.checkOut) return sum;
          return sum + Math.round((s.checkOut.getTime() - s.checkIn.getTime()) / 60000);
        }, 0);
        totalMinutes += dayMinutes;
        return {
          id: last.id,
          date,
          status: last.status,
          checkIn: first.checkIn,
          checkOut: last.checkOut, // null if the latest session today is still open
          minutes: dayMinutes || null,
          latitude: last.latitude,
          longitude: last.longitude,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return ok({ days, totalMinutes, daysPresent: days.filter((d) => d.status === "PRESENT").length });
  } catch (err) {
    console.error("[GET /api/mr/attendance/history]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch attendance history", 500);
  }
}

export const GET = withAuth(handler, [Role.MR]);
