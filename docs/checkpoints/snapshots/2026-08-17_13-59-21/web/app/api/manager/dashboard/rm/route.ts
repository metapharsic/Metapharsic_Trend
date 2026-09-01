import { db } from "@/lib/db";
import { Role, TourPlanStatus, ExpenseStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, notFound, forbidden, apiError } from "@/lib/api-response";
import { startOfUtcDay, startOfUtcMonth, addUtcDays } from "@/lib/date";
import { coveragePercent } from "@/lib/field-tracking";
import {
  resolveTeam,
  membersWithRole,
  growthPercent,
  achievementPercent,
  rankOf,
} from "@/lib/hierarchy";


const TREND_DAYS = 14;
const TOP_N = 8;

/**
 * Regional Manager dashboard.
 *
 * Scope is the RM's org subtree (see lib/hierarchy.ts) and the territories held by
 * that team. Sales are attributed to the **chemist's territory**, not the booking
 * rep's reporting line: in pharma the geography owns the sale, and it keeps regional
 * totals consistent with the cross-region ranking.
 *
 * Note this differs from payroll incentives, which pay on *collections banked*
 * rather than order value. Both are intentional; see docs/03_features/rm_dashboard.md.
 */
async function getRmDashboard(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedEmployeeId = searchParams.get("employeeId");
    const isAdmin = req.user.role === Role.ADMIN;

    if (requestedEmployeeId && !isAdmin) {
      return forbidden("Only an administrator may view another manager's region");
    }

    const rm = requestedEmployeeId
      ? await db.employee.findUnique({ where: { id: requestedEmployeeId } })
      : await db.employee.findUnique({ where: { userId: req.user.sub } });

    if (!rm) {
      return requestedEmployeeId ? notFound("Employee not found") : unauthorized("Employee record not found");
    }

    const team = await resolveTeam(db, rm.id);
    const teamIds = team.map((m) => m.id);
    const scopeIds = [rm.id, ...teamIds];
    const asms = membersWithRole(team, Role.ASM);
    const mrs = membersWithRole(team, Role.MR);

    // Territories held anywhere in the subtree define the region footprint.
    const territories = await db.territory.findMany({
      where: { employeeId: { in: scopeIds } },
      select: { id: true, name: true, region: true, zone: true },
    });
    const territoryIds = territories.map((t) => t.id);
    const regionNames = [...new Set(territories.map((t) => t.region))];

    const today = startOfUtcDay();
    const tomorrow = addUtcDays(today, 1);
    const monthStart = startOfUtcMonth();
    const prevMonthStart = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1)
    );
    const trendStart = addUtcDays(today, -(TREND_DAYS - 1));

    const [
      monthOrderItems,
      prevMonthOrderItems,
      allRegionOrderItems,
      targets,
      attendanceToday,
      visitsToday,
      doctorsInRegion,
      chemistsInRegion,
      doctorsVisited,
      chemistsVisited,
      territoriesVisited,
      newDoctors,
      followUpsDue,
      expensesThisMonth,
      pendingClaims,
      approvedClaims,
      pendingDcrReviews,
      pendingTourPlans,
      pendingLeave,
      plannedDaysDue,
      trendVisits,
      trendOrderItems,
      visitsThisMonth,
    ] = await Promise.all([
      db.orderItem.findMany({
        where: {
          order: { createdAt: { gte: monthStart }, chemist: { territoryId: { in: territoryIds } } },
        },
        select: { price: true, quantity: true, productId: true, order: { select: { chemistId: true } } },
      }),
      db.orderItem.findMany({
        where: {
          order: {
            createdAt: { gte: prevMonthStart, lt: monthStart },
            chemist: { territoryId: { in: territoryIds } },
          },
        },
        select: { price: true, quantity: true },
      }),
      // Every region's sales this month, for the ranking tile.
      db.orderItem.findMany({
        where: { order: { createdAt: { gte: monthStart }, chemistId: { not: null } } },
        select: {
          price: true,
          quantity: true,
          order: { select: { chemist: { select: { territory: { select: { region: true } } } } } },
        },
      }),
      db.target.findMany({
        where: { employeeId: { in: scopeIds }, startDate: { lt: tomorrow }, endDate: { gte: monthStart } },
        select: { value: true },
      }),
      db.attendance.count({
        where: { employeeId: { in: teamIds }, date: today, status: "PRESENT" },
      }),
      db.visit.findMany({
        where: { employeeId: { in: teamIds }, createdAt: { gte: today, lt: tomorrow } },
        select: { doctorId: true, chemistId: true, hospitalId: true },
      }),
      db.doctor.count({ where: { territoryId: { in: territoryIds } } }),
      db.chemist.count({ where: { territoryId: { in: territoryIds } } }),
      db.visit.findMany({
        where: { employeeId: { in: teamIds }, createdAt: { gte: monthStart }, doctorId: { not: null } },
        distinct: ["doctorId"],
        select: { doctorId: true },
      }),
      db.visit.findMany({
        where: { employeeId: { in: teamIds }, createdAt: { gte: monthStart }, chemistId: { not: null } },
        distinct: ["chemistId"],
        select: { chemistId: true },
      }),
      db.visit.findMany({
        where: { employeeId: { in: teamIds }, createdAt: { gte: monthStart } },
        select: { doctor: { select: { territoryId: true } }, chemist: { select: { territoryId: true } } },
      }),
      db.doctor.count({ where: { territoryId: { in: territoryIds }, createdAt: { gte: monthStart } } }),
      db.visit.count({
        where: { employeeId: { in: teamIds }, followUpDate: { not: null, lte: tomorrow } },
      }),
      db.expense.aggregate({
        where: { employeeId: { in: scopeIds }, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      db.expense.count({
        where: {
          employeeId: { in: scopeIds },
          status: { in: [ExpenseStatus.PENDING_ASM, ExpenseStatus.PENDING_RM, ExpenseStatus.PENDING_FINANCE] },
        },
      }),
      db.expense.count({
        where: { employeeId: { in: scopeIds }, status: ExpenseStatus.APPROVED, createdAt: { gte: monthStart } },
      }),
      // "DCR approval" maps to anomaly-flagged visits awaiting a reviewer decision.
      db.visit.count({
        where: {
          employeeId: { in: teamIds },
          anomalyFlag: true,
          anomalyReviews: { none: { status: { in: ["DISMISSED", "CONFIRMED"] } } },
        },
      }),
      db.tourPlan.count({
        where: { employeeId: { in: teamIds }, status: TourPlanStatus.PENDING_ASM },
      }),
      db.leaveRequest.count({ where: { employeeId: { in: teamIds }, status: "PENDING" } }),
      db.tourPlanDay.findMany({
        where: {
          date: { gte: monthStart, lt: today },
          plannedDoctorId: { not: null },
          tourPlan: { employeeId: { in: teamIds }, status: TourPlanStatus.APPROVED },
        },
        select: { date: true, plannedDoctorId: true, tourPlan: { select: { employeeId: true } } },
      }),
      db.visit.findMany({
        where: { employeeId: { in: teamIds }, createdAt: { gte: trendStart } },
        select: { createdAt: true, employeeId: true },
      }),
      db.orderItem.findMany({
        where: {
          order: { createdAt: { gte: trendStart }, chemist: { territoryId: { in: territoryIds } } },
        },
        select: { price: true, quantity: true, order: { select: { createdAt: true } } },
      }),
      db.visit.findMany({
        where: { employeeId: { in: teamIds }, createdAt: { gte: monthStart } },
        select: { employeeId: true, doctorId: true, createdAt: true },
      }),
    ]);

    const lineValue = (i: { price: unknown; quantity: number }) => Number(i.price) * i.quantity;
    const regionalSales = monthOrderItems.reduce((s, i) => s + lineValue(i), 0);
    const prevSales = prevMonthOrderItems.reduce((s, i) => s + lineValue(i), 0);
    const targetValue = targets.reduce((s, t) => s + Number(t.value), 0);

    // Region ranking across the whole company.
    const salesByRegion = new Map<string, number>();
    for (const item of allRegionOrderItems) {
      const region = item.order.chemist?.territory?.region;
      if (!region) continue;
      salesByRegion.set(region, (salesByRegion.get(region) ?? 0) + lineValue(item));
    }
    const regionScores = [...salesByRegion.entries()].map(([key, value]) => ({ key, value }));
    const primaryRegion = regionNames[0] ?? null;

    // Product performance / product sales chart.
    const productTotals = new Map<string, number>();
    for (const item of monthOrderItems) {
      productTotals.set(item.productId, (productTotals.get(item.productId) ?? 0) + lineValue(item));
    }
    const topProductIds = [...productTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([id]) => id);
    const topProducts = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, sku: true },
    });
    const productSales = topProductIds.map((id) => {
      const p = topProducts.find((x) => x.id === id);
      return { name: p?.name ?? "Unknown", sku: p?.sku ?? "", revenue: Math.round(productTotals.get(id) ?? 0) };
    });

    // Area-wise sales, keyed by the chemist's territory.
    const chemistIds = [...new Set(monthOrderItems.map((i) => i.order.chemistId).filter(Boolean))] as string[];
    const chemists = await db.chemist.findMany({
      where: { id: { in: chemistIds } },
      select: { id: true, territoryId: true },
    });
    const chemistTerritory = new Map(chemists.map((c) => [c.id, c.territoryId]));
    const territorySales = new Map<string, number>();
    for (const item of monthOrderItems) {
      const tid = item.order.chemistId ? chemistTerritory.get(item.order.chemistId) : undefined;
      if (!tid) continue;
      territorySales.set(tid, (territorySales.get(tid) ?? 0) + lineValue(item));
    }
    const areaSales = territories
      .map((t) => ({ name: t.name, revenue: Math.round(territorySales.get(t.id) ?? 0) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, TOP_N);

    // Missed calls: approved plans in the past with no matching visit.
    const visitKey = (e: string, d: string, when: Date) => `${e}|${d}|${when.toISOString().slice(0, 10)}`;
    const visitedSet = new Set(
      visitsThisMonth
        .filter((v) => v.doctorId)
        .map((v) => visitKey(v.employeeId, v.doctorId as string, v.createdAt))
    );
    const missedCalls = plannedDaysDue.filter(
      (d) => !visitedSet.has(visitKey(d.tourPlan.employeeId, d.plannedDoctorId as string, d.date))
    ).length;

    // Territory coverage: territories touched by at least one visit this month.
    const touchedTerritories = new Set<string>();
    for (const v of territoriesVisited) {
      const tid = v.doctor?.territoryId ?? v.chemist?.territoryId;
      if (tid) touchedTerritories.add(tid);
    }

    // Rankings.
    const visitsByEmployee = new Map<string, number>();
    for (const v of visitsThisMonth) {
      visitsByEmployee.set(v.employeeId, (visitsByEmployee.get(v.employeeId) ?? 0) + 1);
    }
    const nameOf = (id: string) => {
      const m = team.find((x) => x.id === id);
      return m ? `${m.firstName} ${m.lastName}` : "Unknown";
    };
    const mrRanking = mrs
      .map((m) => ({ name: `${m.firstName} ${m.lastName}`, visits: visitsByEmployee.get(m.id) ?? 0 }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, TOP_N);

    // An ASM's score aggregates their own subtree's visits.
    const asmRanking = asms
      .map((asm) => {
        const descendants = team.filter((m) => m.managerId === asm.id).map((m) => m.id);
        const ids = [asm.id, ...descendants];
        const visits = ids.reduce((s, id) => s + (visitsByEmployee.get(id) ?? 0), 0);
        return { name: `${asm.firstName} ${asm.lastName}`, visits, teamSize: descendants.length };
      })
      .sort((a, b) => b.visits - a.visits)
      .slice(0, TOP_N);

    // Daily trend.
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const visitsByDay = new Map<string, number>();
    for (const v of trendVisits) {
      visitsByDay.set(dayKey(v.createdAt), (visitsByDay.get(dayKey(v.createdAt)) ?? 0) + 1);
    }
    const salesByDay = new Map<string, number>();
    for (const i of trendOrderItems) {
      const k = dayKey(i.order.createdAt);
      salesByDay.set(k, (salesByDay.get(k) ?? 0) + lineValue(i));
    }
    const dailyTrend = Array.from({ length: TREND_DAYS }, (_, offset) => {
      const d = addUtcDays(trendStart, offset);
      const k = dayKey(d);
      return {
        date: k,
        label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
        visits: visitsByDay.get(k) ?? 0,
        sales: Math.round(salesByDay.get(k) ?? 0),
      };
    });

    return ok({
      manager: { id: rm.id, name: `${rm.firstName} ${rm.lastName}`, regions: regionNames },
      kpis: {
        regionalSales: { amount: Math.round(regionalSales) },
        targetAchievement: {
          percent: achievementPercent(regionalSales, targetValue),
          target: targetValue,
          achieved: Math.round(regionalSales),
        },
        regionRanking: {
          rank: primaryRegion ? rankOf(regionScores, primaryRegion) : null,
          totalRegions: regionScores.length,
          region: primaryRegion,
        },
        monthlyGrowth: {
          percent: growthPercent(regionalSales, prevSales),
          current: Math.round(regionalSales),
          previous: Math.round(prevSales),
        },
        productPerformance: { topProducts: productSales.slice(0, 3), totalProducts: productTotals.size },
      },
      team: {
        totalAsms: asms.length,
        totalMrs: mrs.length,
        attendance: { present: attendanceToday, total: team.length },
        activeUsers: team.filter((m) => m.isActive).length,
      },
      fieldActivities: {
        todaysVisits: visitsToday.length,
        doctorCalls: visitsToday.filter((v) => v.doctorId).length,
        chemistCalls: visitsToday.filter((v) => v.chemistId).length,
        hospitalCalls: visitsToday.filter((v) => v.hospitalId).length,
        missedCalls,
        followUpsDue,
      },
      coverage: {
        doctorCoverage: {
          visited: doctorsVisited.length,
          total: doctorsInRegion,
          percent: coveragePercent(doctorsVisited.length, doctorsInRegion),
        },
        chemistCoverage: {
          visited: chemistsVisited.length,
          total: chemistsInRegion,
          percent: coveragePercent(chemistsVisited.length, chemistsInRegion),
        },
        territoryCoverage: {
          visited: touchedTerritories.size,
          total: territories.length,
          percent: coveragePercent(touchedTerritories.size, territories.length),
        },
        newDoctorRegistration: newDoctors,
      },
      expense: {
        regionalExpenses: Number(expensesThisMonth._sum.amount ?? 0),
        pendingClaims,
        approvedClaims,
      },
      approvals: {
        dcrApproval: pendingDcrReviews,
        tourPlanApproval: pendingTourPlans,
        leaveApproval: pendingLeave,
        expenseApproval: pendingClaims,
        total: pendingDcrReviews + pendingTourPlans + pendingLeave + pendingClaims,
      },
      charts: { asmRanking, mrRanking, productSales, areaSales, dailyTrend },
    });
  } catch (err) {
    console.error("[GET /api/manager/dashboard/rm]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to load RM dashboard", 500);
  }
}

export const GET = withAuth(getRmDashboard, [Role.RM, Role.ZSM, Role.NSM, Role.MD, Role.ADMIN]);
