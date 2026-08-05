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

      return {
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.user.email,
        role: emp.user.role,
        isActive: emp.user.isActive,
        territory: emp.territories[0]?.name ?? "Unassigned",
        daysPresent: empAttendance.filter((a) => a.status === "PRESENT").length,
        daysAbsent: empAttendance.filter((a) => a.status === "ABSENT").length,
        daysOnLeave: empAttendance.filter((a) => a.status === "LEAVE").length,
        totalHoursMinutes: totalMinutes,
        attendanceDays: empAttendance.map((a) => ({
          date: a.date.toISOString().slice(0, 10),
          status: a.status,
          checkIn: a.checkIn,
          checkOut: a.checkOut,
          latitude: a.latitude,
          longitude: a.longitude,
        })),
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
