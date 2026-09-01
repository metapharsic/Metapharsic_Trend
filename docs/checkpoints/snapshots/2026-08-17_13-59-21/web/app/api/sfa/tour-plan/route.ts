import { db } from "@/lib/db";
import { Role, TourPlanStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";


async function getTourPlans(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as TourPlanStatus | null;

    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN || req.user.role === Role.MD;

    let where: Record<string, unknown> = {};
    if (status) where = { ...where, status };

    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      where = { ...where, employeeId: employee.id };
    }

    const tourPlans = await db.tourPlan.findMany({
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

    return ok({ tourPlans });
  } catch (err) {
    console.error("[GET /api/sfa/tour-plan]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch tour plans", 500);
  }
}

export const GET = withAuth(getTourPlans, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
