import { db } from "@/lib/db";
import { Role, TourPlanStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";
import { startOfUtcMonth } from "@/lib/date";

async function getTourPlans(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as TourPlanStatus | null;
    const monthParam = searchParams.get("month");
    const autoProvision = searchParams.get("autoProvision") === "true";

    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN || req.user.role === Role.MD;

    let employeeId: string | undefined;

    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      employeeId = employee.id;
    }

    let where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    if (monthParam) {
      where.month = startOfUtcMonth(new Date(`${monthParam}-01`));
    }

    let tourPlans = await db.tourPlan.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        days: {
          include: {
            territory: { select: { id: true, name: true } },
            plannedDoctor: { select: { id: true, fullName: true } },
          },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { month: "desc" },
    });

    // Auto-provision if empty or requested
    if ((tourPlans.length === 0 || autoProvision) && (employeeId || isManager)) {
      const targetEmpId = employeeId ?? (await db.employee.findFirst({ select: { id: true } }))?.id;
      if (targetEmpId) {
        const targetMonth = monthParam ? new Date(`${monthParam}-01`) : new Date();
        try {
          await TourPlanAgentsService.provisionMonthlyPlan({
            employeeId: targetEmpId,
            month: targetMonth,
            overwrite: autoProvision,
          });

          // Re-fetch
          tourPlans = await db.tourPlan.findMany({
            where,
            include: {
              employee: { select: { id: true, firstName: true, lastName: true } },
              days: {
                include: {
                  territory: { select: { id: true, name: true } },
                  plannedDoctor: { select: { id: true, fullName: true } },
                },
                orderBy: { date: "asc" },
              },
            },
            orderBy: { month: "desc" },
          });
        } catch (provErr) {
          console.warn("Auto-provision skipped or failed:", provErr);
        }
      }
    }

    // Run multi-agent evaluation on plans
    const evaluations = await Promise.all(
      tourPlans.map(async (plan) => {
        try {
          return await TourPlanAgentsService.evaluatePlan(plan.id);
        } catch {
          return null;
        }
      })
    );

    const validEvaluations = evaluations.filter(Boolean);
    const agentTelemetry = validEvaluations[0]?.agentTelemetry ?? [];

    return ok({
      tourPlans,
      evaluations: validEvaluations,
      agentTelemetry,
    });
  } catch (err) {
    console.error("[GET /api/sfa/tour-plan]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch tour plans", 500);
  }
}

export const GET = withAuth(getTourPlans, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
