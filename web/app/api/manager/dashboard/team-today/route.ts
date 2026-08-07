import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { startOfUtcDay, addUtcDays } from "@/lib/date";
import { evaluateGpsStatus } from "@/lib/field-tracking";

/**
 * One row per MR, today's activity — the default admin/ASM landing view.
 * No per-rep selection needed to see what the whole field force is doing.
 */
async function handler(req: AuthedRequest) {
  try {
    const today = startOfUtcDay();
    const tomorrow = addUtcDays(today, 1);
    const now = new Date();

    const employees = await db.employee.findMany({
      where: { user: { role: Role.MR } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        territories: { select: { name: true } },
      },
      orderBy: { firstName: "asc" },
    });

    const employeeIds = employees.map((e) => e.id);

    const [attendanceToday, visitsToday, orderItemsToday, collectionsToday, locationLogsToday] = await Promise.all([
      db.attendance.findMany({ where: { employeeId: { in: employeeIds }, date: today } }),
      db.visit.findMany({
        where: { employeeId: { in: employeeIds }, createdAt: { gte: today, lt: tomorrow } },
        select: { employeeId: true },
      }),
      db.orderItem.findMany({
        where: { order: { employeeId: { in: employeeIds }, createdAt: { gte: today, lt: tomorrow } } },
        select: { price: true, quantity: true, order: { select: { employeeId: true } } },
      }),
      db.collection.groupBy({
        by: ["employeeId"],
        where: { employeeId: { in: employeeIds }, createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      db.locationLog.findMany({
        where: { employeeId: { in: employeeIds }, recordedAt: { gte: today, lt: tomorrow } },
        select: { employeeId: true, latitude: true, longitude: true, isMocked: true, recordedAt: true },
        orderBy: { recordedAt: "asc" },
      }),
    ]);

    const attendanceByEmp = new Map(attendanceToday.map((a) => [a.employeeId, a]));
    const visitCountByEmp = new Map<string, number>();
    for (const v of visitsToday) visitCountByEmp.set(v.employeeId, (visitCountByEmp.get(v.employeeId) ?? 0) + 1);
    const salesByEmp = new Map<string, number>();
    for (const item of orderItemsToday) {
      const key = item.order.employeeId;
      if (!key) continue;
      salesByEmp.set(key, (salesByEmp.get(key) ?? 0) + Number(item.price) * item.quantity);
    }
    const collectionByEmp = new Map(collectionsToday.map((c) => [c.employeeId, Number(c._sum.amount ?? 0)]));
    const locationsByEmp = new Map<string, typeof locationLogsToday>();
    for (const log of locationLogsToday) {
      if (!locationsByEmp.has(log.employeeId)) locationsByEmp.set(log.employeeId, []);
      locationsByEmp.get(log.employeeId)!.push(log);
    }

    const team = employees.map((emp) => {
      const attendance = attendanceByEmp.get(emp.id) ?? null;
      const gps = evaluateGpsStatus(locationsByEmp.get(emp.id) ?? [], now);
      return {
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        territory: emp.territories[0]?.name ?? "Unassigned",
        checkedIn: Boolean(attendance),
        checkInTime: attendance?.checkIn ?? null,
        checkedOut: Boolean(attendance?.checkOut),
        callsToday: visitCountByEmp.get(emp.id) ?? 0,
        salesToday: salesByEmp.get(emp.id) ?? 0,
        collectionToday: collectionByEmp.get(emp.id) ?? 0,
        gpsStatus: gps.status,
      };
    });

    return ok({ team, date: today.toISOString() });
  } catch (err) {
    console.error("[GET /api/manager/dashboard/team-today]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch team activity", 500);
  }
}

export const GET = withAuth(handler, [Role.ASM, Role.ADMIN]);
