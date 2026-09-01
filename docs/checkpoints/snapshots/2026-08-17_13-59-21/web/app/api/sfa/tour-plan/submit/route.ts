import { db } from "@/lib/db";
import { Role, TourPlanStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, conflict, apiError } from "@/lib/api-response";
import { SubmitTourPlanSchema } from "@/lib/validators";
import { startOfUtcDay, startOfUtcMonth } from "@/lib/date";


async function submitTourPlan(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const body = await req.json();
    const parsed = SubmitTourPlanSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { month, days } = parsed.data;
    const normalizedMonth = startOfUtcMonth(month);

    const existing = await db.tourPlan.findUnique({
      where: { employeeId_month: { employeeId: employee.id, month: normalizedMonth } },
    });

    if (existing && existing.status !== TourPlanStatus.DRAFT && existing.status !== TourPlanStatus.REJECTED) {
      return conflict("A tour plan for this month is already submitted or approved");
    }

    const tourPlan = await db.$transaction(async (tx) => {
      const plan = existing
        ? await tx.tourPlan.update({
            where: { id: existing.id },
            data: { status: TourPlanStatus.PENDING_ASM, approvedById: null },
          })
        : await tx.tourPlan.create({
            data: { employeeId: employee.id, month: normalizedMonth, status: TourPlanStatus.PENDING_ASM },
          });

      await tx.tourPlanDay.deleteMany({ where: { tourPlanId: plan.id } });
      await tx.tourPlanDay.createMany({
        data: days.map((day) => ({
          tourPlanId: plan.id,
          date: startOfUtcDay(day.date),
          territoryId: day.territoryId,
          plannedDoctorId: day.plannedDoctorId,
        })),
      });

      return plan;
    });

    return ok({ tourPlanId: tourPlan.id, status: tourPlan.status });
  } catch (err) {
    console.error("[POST /api/sfa/tour-plan/submit]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to submit tour plan", 500);
  }
}

export const POST = withAuth(submitTourPlan, [Role.MR]);
