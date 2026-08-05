import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { startOfUtcDay, addUtcDays } from "@/lib/date";

async function getAsmDashboard(req: AuthedRequest) {
  try {
    const todayStart = startOfUtcDay();
    const todayEnd = addUtcDays(todayStart, 1);

    let managerId: string | undefined;
    if (req.user.role === Role.ASM) {
      const asmEmployee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!asmEmployee) return unauthorized("Employee record not found");
      managerId = asmEmployee.id;
    }

    const mrs = await db.employee.findMany({
      where: {
        user: { role: Role.MR },
        ...(managerId ? { managerId } : {}),
      },
      include: {
        territories: { select: { name: true } },
      },
      orderBy: { firstName: "asc" },
    });

    const mrData = await Promise.all(
      mrs.map(async (mr) => {
        const [targets, orders, callsCompleted, plannedDay, attendance, collections] = await Promise.all([
          db.target.findMany({
            where: { employeeId: mr.id, startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
          }),
          db.order.findMany({
            where: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } },
            include: { items: true },
          }),
          db.visit.count({ where: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } } }),
          db.tourPlanDay.count({
            where: {
              date: { gte: todayStart, lt: todayEnd },
              tourPlan: { employeeId: mr.id, status: "APPROVED" },
            },
          }),
          db.attendance.findUnique({ where: { employeeId_date: { employeeId: mr.id, date: todayStart } } }),
          db.collection.aggregate({
            where: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } },
            _sum: { amount: true },
          }),
        ]);

        const target = targets.reduce((sum, t) => sum + Number(t.value), 0);
        const achieved = orders.reduce(
          (sum, o) => sum + o.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0),
          0
        );

        return {
          employeeId: mr.id,
          employeeName: `${mr.firstName} ${mr.lastName}`,
          territoryName: mr.territories[0]?.name ?? "Unassigned",
          sales: { target, achieved, percentage: target > 0 ? Math.round((achieved / target) * 1000) / 10 : 0 },
          callsPlanned: plannedDay,
          callsCompleted,
          isCheckedIn: !!attendance,
          collected: Number(collections._sum.amount ?? 0),
        };
      })
    );

    const totalCollected = mrData.reduce((sum, mr) => sum + mr.collected, 0);

    return ok({ mrs: mrData, totalCollected });
  } catch (err) {
    console.error("[GET /api/asm/dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch ASM dashboard", 500);
  }
}

export const GET = withAuth(getAsmDashboard, [Role.ASM, Role.ADMIN, Role.MD]);
