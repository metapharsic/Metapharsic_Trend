import { PrismaClient, Role, TourPlanStatus, ExpenseStatus, ClaimStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { startOfUtcDay, startOfUtcMonth } from "@/lib/date";

const db = new PrismaClient();

const LOW_STOCK_THRESHOLD = 50;
const LIVE_LOCATION_WINDOW_MINUTES = 15;

async function getAdminKpis(req: AuthedRequest) {
  try {
    const today = startOfUtcDay();
    const monthStart = startOfUtcMonth();
    const liveSince = new Date(Date.now() - LIVE_LOCATION_WINDOW_MINUTES * 60 * 1000);

    const [
      totalEmployees,
      activeMRs,
      todaysAttendancePresent,
      liveLocationEmployeeIds,
      doctorsVisitedThisMonth,
      totalDoctors,
      chemistsVisitedThisMonth,
      totalChemists,
      hospitalsVisitedThisMonth,
      totalHospitals,
      ordersThisMonth,
      orderItemsThisMonth,
      collectionsThisMonth,
      pendingTourPlans,
      pendingExpenseApprovals,
      pendingClaims,
      visitCountsByEmployee,
      expensesThisMonth,
      pendingLeaveRequests,
      anomalousVisitsThisMonth,
      mockedLocationLogsThisMonth,
      approvedTourPlanDaysDue,
      newDoctorsThisMonth,
      products,
    ] = await Promise.all([
      db.employee.count(),
      db.employee.count({ where: { user: { role: Role.MR, isActive: true } } }),
      db.attendance.count({ where: { date: { gte: today }, status: "PRESENT" } }),
      db.locationLog.findMany({
        where: { recordedAt: { gte: liveSince } },
        distinct: ["employeeId"],
        select: { employeeId: true },
      }),
      db.visit.findMany({
        where: { createdAt: { gte: monthStart }, doctorId: { not: null } },
        distinct: ["doctorId"],
        select: { doctorId: true },
      }),
      db.doctor.count(),
      db.visit.findMany({
        where: { createdAt: { gte: monthStart }, chemistId: { not: null } },
        distinct: ["chemistId"],
        select: { chemistId: true },
      }),
      db.chemist.count(),
      db.visit.findMany({
        where: { createdAt: { gte: monthStart }, hospitalId: { not: null } },
        distinct: ["hospitalId"],
        select: { hospitalId: true },
      }),
      db.hospital.count(),
      db.order.count({ where: { createdAt: { gte: monthStart } } }),
      db.orderItem.findMany({
        where: { order: { createdAt: { gte: monthStart } } },
        select: { price: true, quantity: true },
      }),
      db.collection.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      db.tourPlan.count({ where: { status: TourPlanStatus.PENDING_ASM } }),
      db.expense.count({
        where: {
          status: {
            in: [ExpenseStatus.PENDING_ASM, ExpenseStatus.PENDING_RM, ExpenseStatus.PENDING_FINANCE],
          },
        },
      }),
      db.claim.count({
        where: { status: { in: [ClaimStatus.PENDING_MR, ClaimStatus.PENDING_ASM] } },
      }),
      db.visit.groupBy({
        by: ["employeeId"],
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      db.expense.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      db.leaveRequest.count({ where: { status: "PENDING" } }),
      db.visit.count({ where: { createdAt: { gte: monthStart }, anomalyFlag: true } }),
      db.locationLog.count({ where: { recordedAt: { gte: monthStart }, isMocked: true } }),
      db.tourPlanDay.findMany({
        where: {
          date: { gte: monthStart, lt: today },
          plannedDoctorId: { not: null },
          tourPlan: { status: TourPlanStatus.APPROVED },
        },
        select: { date: true, plannedDoctorId: true, tourPlan: { select: { employeeId: true } } },
      }),
      db.doctor.count({ where: { createdAt: { gte: monthStart } } }),
      db.product.findMany({ select: { stockQty: true } }),
    ]);

    // Top/low performers by visit count this month
    const employeeIds = visitCountsByEmployee.map((v) => v.employeeId);
    const employees = await db.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const employeeNameMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
    const ranked = visitCountsByEmployee
      .map((v) => ({
        employeeId: v.employeeId,
        name: employeeNameMap.get(v.employeeId) ?? "Unknown",
        visitCount: v._count._all,
      }))
      .sort((a, b) => b.visitCount - a.visitCount);

    const topPerformers = ranked.slice(0, 5);
    const lowPerformers = ranked.slice(-5).reverse();

    // Missed calls: planned TP days (past, approved) with no matching visit that day
    let missedCalls = 0;
    if (approvedTourPlanDaysDue.length > 0) {
      const visitsInRange = await db.visit.findMany({
        where: { createdAt: { gte: monthStart, lt: today }, doctorId: { not: null } },
        select: { employeeId: true, doctorId: true, createdAt: true },
      });
      const visitKey = (employeeId: string, doctorId: string, date: Date) =>
        `${employeeId}|${doctorId}|${date.toDateString()}`;
      const visitedSet = new Set(
        visitsInRange.map((v) => visitKey(v.employeeId, v.doctorId as string, v.createdAt))
      );
      missedCalls = approvedTourPlanDaysDue.filter(
        (day) =>
          !visitedSet.has(visitKey(day.tourPlan.employeeId, day.plannedDoctorId as string, day.date))
      ).length;
    }

    const sales = orderItemsThisMonth.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    const lowStockProducts = products.filter((p) => p.stockQty < LOW_STOCK_THRESHOLD).length;

    return ok({
      totalEmployees,
      activeMRs,
      todaysAttendance: { present: todaysAttendancePresent, total: activeMRs },
      liveLocation: { online: liveLocationEmployeeIds.length, total: activeMRs },
      doctorsCovered: { visited: doctorsVisitedThisMonth.length, total: totalDoctors },
      chemistsCovered: { visited: chemistsVisitedThisMonth.length, total: totalChemists },
      hospitalsCovered: { visited: hospitalsVisitedThisMonth.length, total: totalHospitals },
      orders: { count: ordersThisMonth },
      sales: { amount: sales },
      collections: { amount: Number(collectionsThisMonth._sum.amount ?? 0) },
      pendingApprovals: {
        tourPlans: pendingTourPlans,
        expenses: pendingExpenseApprovals,
        claims: pendingClaims,
        total: pendingTourPlans + pendingExpenseApprovals + pendingClaims,
      },
      topPerformers,
      lowPerformers,
      expenses: { amount: Number(expensesThisMonth._sum.amount ?? 0) },
      leaveRequests: { pending: pendingLeaveRequests },
      gpsViolations: { anomalousVisits: anomalousVisitsThisMonth, mockedLocations: mockedLocationLogsThisMonth },
      missedCalls: { count: missedCalls },
      newDoctorsAdded: { count: newDoctorsThisMonth },
      stockStatus: { lowStock: lowStockProducts, total: products.length },
    });
  } catch (err) {
    console.error("[GET /api/manager/dashboard/admin-kpis]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch admin KPIs", 500);
  }
}

export const GET = withAuth(getAdminKpis, [Role.ADMIN]);
