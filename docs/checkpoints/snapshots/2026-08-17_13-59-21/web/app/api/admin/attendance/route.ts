import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return badRequest("month must be YYYY-MM");

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const employees = await db.employee.findMany({
      where: { user: { role: { in: [Role.MR, Role.ASM] } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { email: true, role: true, isActive: true } },
        territories: { select: { name: true } },
      },
      orderBy: { firstName: "asc" },
    });

    const employeeIds = employees.map((e) => e.id);

    const [attendance, leaves, latestLocations] = await Promise.all([
      db.attendance.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: start, lt: end } },
        orderBy: { date: "asc" },
      }),
      db.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          OR: [{ startDate: { lt: end } }, { endDate: { gte: start } }],
        },
        orderBy: { startDate: "desc" },
      }),
      db.locationLog.findMany({
        where: { employeeId: { in: employeeIds } },
        orderBy: { recordedAt: "desc" },
        distinct: ["employeeId"],
      }),
    ]);

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const locationByEmployee = Object.fromEntries(latestLocations.map((l) => [l.employeeId, l]));

    const roster = employees.map((emp) => {
      const empAttendance = attendance.filter((a) => a.employeeId === emp.id);
      const empLeaves = leaves.filter((l) => l.employeeId === emp.id);
      const totalMinutes = empAttendance.reduce((sum, a) => {
        if (!a.checkOut) return sum;
        return sum + Math.round((a.checkOut.getTime() - a.checkIn.getTime()) / 60000);
      }, 0);
      const location = locationByEmployee[emp.id] ?? null;

      // Multiple check-in/out sessions can now exist per employee per day —
      // collapse them into one cell per calendar date for the roster grid.
      const byDate = new Map<string, typeof empAttendance>();
      for (const a of empAttendance) {
        const key = a.date.toISOString().slice(0, 10);
        if (!byDate.has(key)) byDate.set(key, []);
        byDate.get(key)!.push(a);
      }
      const dailyRecords = Array.from(byDate.entries())
        .map(([date, sessions]) => {
          const sorted = [...sessions].sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          return {
            date,
            status: last.status,
            checkIn: first.checkIn,
            checkOut: last.checkOut, // null if the latest session is still open
            latitude: last.latitude,
            longitude: last.longitude,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.user.email,
        role: emp.user.role,
        isActive: emp.user.isActive,
        territory: emp.territories[0]?.name ?? "Unassigned",
        daysPresent: dailyRecords.filter((d) => d.status === "PRESENT").length,
        daysAbsent: dailyRecords.filter((d) => d.status === "ABSENT").length,
        daysOnLeave: dailyRecords.filter((d) => d.status === "LEAVE").length,
        totalHoursMinutes: totalMinutes,
        attendanceDays: dailyRecords,
        leaves: empLeaves.map((l) => ({
          id: l.id,
          startDate: l.startDate.toISOString().slice(0, 10),
          endDate: l.endDate.toISOString().slice(0, 10),
          type: l.type,
          status: l.status,
          reason: l.reason,
        })),
        lastKnownLocation: location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
              recordedAt: location.recordedAt,
              isLive: location.recordedAt >= fifteenMinAgo,
              isMocked: location.isMocked,
            }
          : null,
      };
    });

    return ok({ roster, month });
  } catch (err) {
    console.error("[GET /api/admin/attendance]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch attendance roster", 500);
  }
}

export const GET = withAuth(handler, [Role.ADMIN, Role.HR, Role.ASM, Role.MD]);
