import { db } from "@/lib/db";
import { Role, ExpenseStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { startOfUtcDay } from "@/lib/date";

async function getFinanceDashboard(_req: AuthedRequest) {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const payrollMonth = startOfUtcDay(monthStart);

    const [
      pendingExpenses,
      pendingCount,
      disbursedAgg,
      totalEmployees,
      payrollGeneratedCount,
      duplicateHashGroups,
      leaveOverlapCandidates,
    ] = await Promise.all([
      db.expense.findMany({
        where: { status: ExpenseStatus.PENDING_FINANCE },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { employee: { select: { firstName: true, lastName: true, user: { select: { role: true } } } } },
      }),
      db.expense.count({ where: { status: ExpenseStatus.PENDING_FINANCE } }),
      db.expense.aggregate({
        where: { status: ExpenseStatus.APPROVED, updatedAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      db.employee.count({ where: { user: { role: { in: [Role.MR, Role.ASM] } } } }),
      db.payroll.count({ where: { month: payrollMonth } }),
      db.expense.groupBy({
        by: ["receiptHash"],
        where: { receiptHash: { not: null } },
        _count: { receiptHash: true },
        having: { receiptHash: { _count: { gt: 1 } } },
      }),
      db.expense.findMany({
        where: { status: { in: [ExpenseStatus.PENDING_ASM, ExpenseStatus.PENDING_RM, ExpenseStatus.PENDING_FINANCE] } },
        include: { employee: { select: { firstName: true, lastName: true, leaveRequests: { where: { status: "APPROVED" } } } } },
      }),
    ]);

    // Duplicate-receipt fraud alerts — real, from actual receiptHash collisions
    const duplicateHashes = duplicateHashGroups.map((g) => g.receiptHash).filter(Boolean) as string[];
    const duplicateExpenses = duplicateHashes.length
      ? await db.expense.findMany({
          where: { receiptHash: { in: duplicateHashes } },
          include: { employee: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const seenHash = new Set<string>();
    const duplicateAlerts = duplicateExpenses
      .filter((e) => {
        if (seenHash.has(e.receiptHash!)) return true;
        seenHash.add(e.receiptHash!);
        return false;
      })
      .map((e) => ({
        id: `dup-${e.id}`,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        reason: "Duplicate receipt hash detected",
        severity: "high" as const,
        amount: Number(e.amount),
        date: e.createdAt,
      }));

    // Claim-date-on-approved-leave alerts — real, cross-referencing LeaveRequest
    const leaveOverlapAlerts = leaveOverlapCandidates
      .filter((e) =>
        e.employee.leaveRequests.some((l) => e.createdAt >= l.startDate && e.createdAt <= l.endDate)
      )
      .map((e) => ({
        id: `leave-${e.id}`,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        reason: "Claim date falls on approved leave",
        severity: "medium" as const,
        amount: Number(e.amount),
        date: e.createdAt,
      }));

    const alerts = [...duplicateAlerts, ...leaveOverlapAlerts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const payrollReadiness = totalEmployees > 0 ? Math.round((payrollGeneratedCount / totalEmployees) * 100) : 0;

    const allEligible = await db.employee.findMany({
      where: { user: { role: { in: [Role.MR, Role.ASM] } } },
      select: { id: true, firstName: true, lastName: true, payrolls: { where: { month: payrollMonth }, select: { id: true } } },
    });
    const pendingPayrollEmployees = allEligible
      .filter((e) => e.payrolls.length === 0)
      .map((e) => ({ employeeId: e.id, name: `${e.firstName} ${e.lastName}` }));

    return ok({
      kpis: {
        pendingApprovals: pendingCount,
        disbursedMtd: Number(disbursedAgg._sum.amount ?? 0),
        fraudAlerts: alerts.length,
        payrollReadiness,
      },
      expenses: pendingExpenses.map((e) => ({
        id: e.id,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        role: e.employee.user.role,
        amount: Number(e.amount),
        category: e.category,
        date: e.createdAt,
        receiptUrl: e.receiptUrl,
        status: e.status,
      })),
      alerts,
      pendingPayrollEmployees,
      payrollMonth: payrollMonth.toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error("[GET /api/finance/dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch finance dashboard", 500);
  }
}

export const GET = withAuth(getFinanceDashboard, [Role.FINANCE, Role.ADMIN]);
