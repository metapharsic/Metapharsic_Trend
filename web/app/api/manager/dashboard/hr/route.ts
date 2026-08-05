import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { startOfUtcDay, startOfUtcMonth } from "@/lib/date";

/**
 * Company-wide HR view — headcount/attrition/attendance/leave/payroll/training
 * across every role, not one team's subtree. No drill-down param: HR sees all.
 */
async function getHrDashboard(req: AuthedRequest) {
  try {
    const today = startOfUtcDay();
    const monthStart = startOfUtcMonth();

    const [
      totalEmployees,
      activeEmployees,
      headcountByRole,
      todaysAttendancePresent,
      todaysAttendanceTotal,
      absentToday,
      pendingLeaves,
      approvedLeavesThisMonth,
      onLeaveToday,
      payrollsThisMonth,
      lockedUsers,
      enrollments,
      newHiresThisMonth,
    ] = await Promise.all([
      db.employee.count(),
      db.employee.count({ where: { user: { isActive: true } } }),
      db.user.groupBy({
        by: ["role"],
        where: { employee: { isNot: null } },
        _count: { _all: true },
      }),
      db.attendance.count({ where: { date: { gte: today }, status: "PRESENT" } }),
      db.employee.count({ where: { user: { isActive: true } } }),
      db.attendance.count({ where: { date: { gte: today }, status: "ABSENT" } }),
      db.leaveRequest.count({ where: { status: "PENDING" } }),
      db.leaveRequest.count({ where: { status: "APPROVED", startDate: { gte: monthStart } } }),
      db.leaveRequest.count({
        where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
      }),
      db.payroll.findMany({
        where: { month: monthStart },
        select: { netPayable: true, employeeId: true },
      }),
      db.user.count({ where: { lockedAt: { not: null } } }),
      db.lMSEnrollment.findMany({
        select: { completed: true, progressPercent: true },
      }),
      db.employee.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    const payrollTotal = payrollsThisMonth.reduce((sum, p) => sum + Number(p.netPayable), 0);
    const payrollGenerated = payrollsThisMonth.length;
    const payrollPending = Math.max(0, activeEmployees - payrollGenerated);

    const trainingCompleted = enrollments.filter((e) => e.completed).length;
    const trainingInProgress = enrollments.filter((e) => !e.completed && e.progressPercent > 0).length;
    const trainingNotStarted = enrollments.filter((e) => !e.completed && e.progressPercent === 0).length;

    return ok({
      workforce: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees: totalEmployees - activeEmployees,
        newHiresThisMonth,
        byRole: headcountByRole.map((r) => ({ role: r.role, count: r._count._all })),
      },
      attendance: {
        present: todaysAttendancePresent,
        absent: absentToday,
        onLeave: onLeaveToday,
        total: todaysAttendanceTotal,
      },
      leave: {
        pending: pendingLeaves,
        approvedThisMonth: approvedLeavesThisMonth,
        onLeaveToday,
      },
      payroll: {
        month: monthStart,
        generated: payrollGenerated,
        pending: payrollPending,
        totalPayout: payrollTotal,
      },
      compliance: {
        lockedAccounts: lockedUsers,
      },
      training: {
        completed: trainingCompleted,
        inProgress: trainingInProgress,
        notStarted: trainingNotStarted,
        total: enrollments.length,
      },
    });
  } catch (err) {
    console.error("[GET /api/manager/dashboard/hr]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch HR dashboard", 500);
  }
}

export const GET = withAuth(getHrDashboard, [Role.HR, Role.ADMIN]);
