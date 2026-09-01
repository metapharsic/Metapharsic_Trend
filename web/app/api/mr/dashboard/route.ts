import { db } from "@/lib/db";
import { Role, TourPlanStatus, ExpenseStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, forbidden, notFound, apiError } from "@/lib/api-response";
import { startOfUtcDay, startOfUtcMonth, addUtcDays } from "@/lib/date";
import { evaluateGpsStatus, travelDistanceKm, coveragePercent } from "@/lib/field-tracking";
import { buildNotifications, monthElapsedFraction, RULE_THRESHOLDS } from "@/lib/notifications";
import { outstandingBalance, creditStatus, round2 } from "@/lib/credit";


/**
 * Medical Representative daily overview.
 * Assembles the twelve dashboard tiles plus the derived notification feed.
 * Business rules live in lib/field-tracking.ts and lib/notifications.ts so they
 * stay testable independently of this query layer.
 */
async function getMrDashboard(req: AuthedRequest) {
  try {
    // Managers may inspect a specific rep's day via ?employeeId=; without it they
    // would otherwise see their own (empty) field activity, which is meaningless.
    const { searchParams } = new URL(req.url);
    const requestedEmployeeId = searchParams.get("employeeId");
    const isManager = ([
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
    ] as Role[]).includes(req.user.role as Role);

    if (requestedEmployeeId && !isManager) {
      return forbidden("You may only view your own dashboard");
    }

    const employee = requestedEmployeeId
      ? await db.employee.findUnique({
          where: { id: requestedEmployeeId },
          include: { territories: { select: { id: true } } },
        })
      : await db.employee.findUnique({
          where: { userId: req.user.sub },
          include: { territories: { select: { id: true } } },
        });

    if (!employee) {
      return requestedEmployeeId
        ? notFound("Employee not found")
        : unauthorized("Employee record not found");
    }

    const territoryIds = employee.territories.map((t) => t.id);
    const today = startOfUtcDay();
    const tomorrow = addUtcDays(today, 1);
    const monthStart = startOfUtcMonth();
    const dow = today.getUTCDay();
    const weekStart = addUtcDays(today, -((dow + 6) % 7)); // Monday
    const now = new Date();

    const [
      plannedDays,
      visitsToday,
      orderItemsToday,
      collectionsToday,
      collectionsWeek,
      collectionsMonth,
      samplesToday,
      doctorsInTerritory,
      chemistsInTerritory,
      doctorsVisitedThisMonth,
      chemistsVisitedThisMonth,
      locationLogsToday,
      attendanceToday,
      expensesToday,
      pendingExpenses,
      rejectedExpenses,
      currentTourPlan,
      nextMonthTourPlan,
      lowStockInventory,
      territoryChemists,
      territoryOrderItems,
      territoryCollections,
      invoicesList,
      agedInvoicesCount,
    ] = await Promise.all([
      db.tourPlanDay.findMany({
        where: {
          date: { gte: today, lt: tomorrow },
          tourPlan: { employeeId: employee.id, status: TourPlanStatus.APPROVED },
        },
        include: { plannedDoctor: { select: { id: true, fullName: true, dpsTier: true } } },
      }),
      db.visit.findMany({
        where: { employeeId: employee.id, createdAt: { gte: today, lt: tomorrow } },
        select: {
          id: true,
          doctorId: true,
          chemistId: true,
          hospitalId: true,
          createdAt: true,
          doctor: { select: { fullName: true } },
          chemist: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.orderItem.findMany({
        where: {
          order: { employeeId: employee.id, createdAt: { gte: today, lt: tomorrow } },
        },
        select: { price: true, quantity: true },
      }),
      db.collection.aggregate({
        where: { employeeId: employee.id, createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      db.collection.aggregate({
        where: { employeeId: employee.id, createdAt: { gte: weekStart } },
        _sum: { amount: true },
      }),
      db.collection.aggregate({
        where: { employeeId: employee.id, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      db.sample.findMany({
        where: { visit: { employeeId: employee.id, createdAt: { gte: today, lt: tomorrow } } },
        select: { quantity: true },
      }),
      db.doctor.count({ where: { territoryId: { in: territoryIds } } }),
      db.chemist.count({ where: { territoryId: { in: territoryIds } } }),
      db.visit.findMany({
        where: {
          employeeId: employee.id,
          createdAt: { gte: monthStart },
          doctorId: { not: null },
        },
        distinct: ["doctorId"],
        select: { doctorId: true },
      }),
      db.visit.findMany({
        where: {
          employeeId: employee.id,
          createdAt: { gte: monthStart },
          chemistId: { not: null },
        },
        distinct: ["chemistId"],
        select: { chemistId: true },
      }),
      db.locationLog.findMany({
        where: { employeeId: employee.id, recordedAt: { gte: today, lt: tomorrow } },
        select: { latitude: true, longitude: true, isMocked: true, recordedAt: true },
        orderBy: { recordedAt: "asc" },
      }),
      db.attendance.findFirst({ where: { employeeId: employee.id, date: today }, orderBy: { checkIn: "desc" } }),
      db.expense.aggregate({
        where: { employeeId: employee.id, createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      db.expense.count({
        where: {
          employeeId: employee.id,
          status: {
            in: [ExpenseStatus.PENDING_ASM, ExpenseStatus.PENDING_RM, ExpenseStatus.PENDING_FINANCE],
          },
        },
      }),
      db.expense.count({
        where: { employeeId: employee.id, status: ExpenseStatus.REJECTED },
      }),
      db.tourPlan.findUnique({
        where: { employeeId_month: { employeeId: employee.id, month: monthStart } },
        select: { status: true },
      }),
      db.tourPlan.findUnique({
        where: {
          employeeId_month: {
            employeeId: employee.id,
            month: new Date(
              Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
            ),
          },
        },
        select: { status: true },
      }),
      db.sampleInventory.count({
        where: { employeeId: employee.id, quantity: { lte: RULE_THRESHOLDS.lowSampleStock } },
      }),
      db.chemist.findMany({
        where: { territoryId: { in: territoryIds } },
        select: { id: true, creditLimit: true },
      }),
      db.orderItem.findMany({
        where: { order: { chemist: { territoryId: { in: territoryIds } }, status: { not: "CANCELLED" } } },
        select: { price: true, quantity: true, order: { select: { chemistId: true } } },
      }),
      db.collection.findMany({
        where: { chemist: { territoryId: { in: territoryIds } } },
        select: { amount: true, chemistId: true },
      }),
      db.invoice.findMany({
        where: { order: { employeeId: employee.id } },
        select: {
          id: true,
          invoiceNo: true,
          amount: true,
          paid: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              chemist: { select: { name: true } },
              distributor: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.invoice.count({
        where: {
          order: { employeeId: employee.id },
          paid: false,
          createdAt: { lt: addUtcDays(startOfUtcDay(now), -RULE_THRESHOLDS.agedBillingDays) },
        },
      }),
    ]);

    // A planned call counts as completed only when that specific doctor was visited today.
    const visitedDoctorIdsToday = new Set(
      visitsToday.map((v) => v.doctorId).filter(Boolean) as string[]
    );
    const plannedDoctorIds = plannedDays
      .map((d) => d.plannedDoctor?.id)
      .filter(Boolean) as string[];
    const completedPlanned = plannedDoctorIds.filter((id) => visitedDoctorIdsToday.has(id));
    const pendingPlanned = plannedDays.filter(
      (d) => d.plannedDoctor && !visitedDoctorIdsToday.has(d.plannedDoctor.id)
    );

    const salesToday = orderItemsToday.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );
    const samplesDistributed = samplesToday.reduce((sum, s) => sum + s.quantity, 0);

    const gps = evaluateGpsStatus(locationLogsToday, now);
    const travelKm = travelDistanceKm(locationLogsToday);

    const doctorCoverage = coveragePercent(doctorsVisitedThisMonth.length, doctorsInTerritory);

    const orderedByChemist = new Map<string, number>();
    for (const item of territoryOrderItems) {
      const key = item.order.chemistId;
      if (!key) continue;
      orderedByChemist.set(key, (orderedByChemist.get(key) ?? 0) + Number(item.price) * item.quantity);
    }
    const collectedByChemist = new Map<string, number>();
    for (const c of territoryCollections) {
      collectedByChemist.set(c.chemistId, (collectedByChemist.get(c.chemistId) ?? 0) + Number(c.amount));
    }
    let breachedCreditChemists = 0;
    let warningCreditChemists = 0;
    let totalOutstanding = 0;
    for (const chemist of territoryChemists) {
      const outstanding = outstandingBalance(orderedByChemist.get(chemist.id) ?? 0, collectedByChemist.get(chemist.id) ?? 0);
      totalOutstanding += outstanding;
      const status = creditStatus({
        creditLimit: chemist.creditLimit !== null ? Number(chemist.creditLimit) : null,
        outstanding,
      });
      if (status === "BREACHED") breachedCreditChemists++;
      if (status === "WARNING") warningCreditChemists++;
    }

    const notifications = buildNotifications({
      now,
      checkedIn: Boolean(attendanceToday) && !attendanceToday?.checkOut,
      gpsStatus: gps.status,
      pendingVisits: pendingPlanned.length,
      tourPlanStatus: (currentTourPlan?.status ?? "NONE") as
        | "NONE"
        | "DRAFT"
        | "PENDING_ASM"
        | "APPROVED"
        | "REJECTED",
      nextMonthTourPlanSubmitted: Boolean(nextMonthTourPlan),
      rejectedExpenseCount: rejectedExpenses,
      lowStockProducts: lowStockInventory,
      doctorCoveragePercent: doctorCoverage,
      monthElapsedFraction: monthElapsedFraction(now),
      breachedCreditChemists,
      warningCreditChemists,
      agedInvoices: agedInvoicesCount,
    });

    // Persist critical/error alerts so admins can see a cross-MR feed with read state.
    const persistWorthy = notifications.filter((n) => n.severity === "CRITICAL" || n.severity === "ERROR");
    if (persistWorthy.length > 0) {
      await Promise.all(
        persistWorthy.map((n) =>
          db.notification.upsert({
            where: { employeeId_code: { employeeId: employee.id, code: n.code } },
            create: { employeeId: employee.id, code: n.code, severity: n.severity, message: n.message, action: n.action },
            update: { severity: n.severity, message: n.message, action: n.action, read: false },
          })
        )
      );
    }

    return ok({
      todaysVisits: {
        planned: plannedDays.length,
        list: pendingPlanned.map((d) => ({
          doctorId: d.plannedDoctor!.id,
          name: d.plannedDoctor!.fullName,
          tier: d.plannedDoctor!.dpsTier,
        })),
      },
      pendingVisits: { count: pendingPlanned.length },
      completedVisits: {
        total: visitsToday.length,
        planned: completedPlanned.length,
        unplanned: visitsToday.length - completedPlanned.length,
        list: visitsToday.map((v) => ({
          id: v.id,
          name: v.doctor?.fullName ?? v.chemist?.name ?? "Unknown",
          createdAt: v.createdAt.toISOString(),
        })),
      },
      salesToday: { amount: salesToday },
      collection: {
        amount: Number(collectionsToday._sum.amount ?? 0),
        today: Number(collectionsToday._sum.amount ?? 0),
        week: Number(collectionsWeek._sum.amount ?? 0),
        month: Number(collectionsMonth._sum.amount ?? 0),
        outstanding: round2(totalOutstanding),
      },
      samplesDistributed: { units: samplesDistributed },
      doctorCoverage: {
        visited: doctorsVisitedThisMonth.length,
        total: doctorsInTerritory,
        percent: doctorCoverage,
      },
      chemistCoverage: {
        visited: chemistsVisitedThisMonth.length,
        total: chemistsInTerritory,
        percent: coveragePercent(chemistsVisitedThisMonth.length, chemistsInTerritory),
      },
      travelDistance: { km: travelKm, fixes: locationLogsToday.length },
      gpsStatus: {
        status: gps.status,
        lastFixAt: gps.lastFixAt,
        minutesSinceLastFix: gps.minutesSinceLastFix,
        critical: gps.critical,
      },
      expenses: {
        today: Number(expensesToday._sum.amount ?? 0),
        pending: pendingExpenses,
        rejected: rejectedExpenses,
      },
      notifications,
      attendance: {
        checkedIn: Boolean(attendanceToday) && !attendanceToday?.checkOut,
        checkInTime: attendanceToday?.checkIn ?? null,
        checkedOut: Boolean(attendanceToday?.checkOut),
      },
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        isSelf: !requestedEmployeeId,
      },
      invoices: invoicesList.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        amount: Number(inv.amount),
        paid: inv.paid,
        createdAt: inv.createdAt.toISOString(),
        orderId: inv.order.id,
        chemistName: inv.order.chemist?.name || "Unknown Chemist",
        distributorName: inv.order.distributor?.name || "Unknown Distributor",
      })),
    });
  } catch (err) {
    console.error("[GET /api/mr/dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to load MR dashboard", 500);
  }
}

export const GET = withAuth(getMrDashboard, [
  Role.MR,
  Role.ASM,
  Role.RM,
  Role.ZSM,
  Role.NSM,
  Role.MD,
  Role.ADMIN,
]);
