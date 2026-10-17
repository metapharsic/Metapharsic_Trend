import { db } from "@/lib/db";
import { Role, TourPlanStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, conflict, apiError } from "@/lib/api-response";
import { SubmitTourPlanSchema } from "@/lib/validators";
import { startOfUtcDay, startOfUtcMonth } from "@/lib/date";
import { TourPlanAgentsService } from "@/services/tour-plan-agents.service";

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

    const isManager = req.user.role === Role.ADMIN || req.user.role === Role.MD;
    if (existing && existing.status !== TourPlanStatus.DRAFT && existing.status !== TourPlanStatus.REJECTED && !isManager) {
      return conflict("A tour plan for this month is already submitted or approved");
    }

    const targetStatus = isManager ? TourPlanStatus.APPROVED : TourPlanStatus.PENDING_ASM;
    const targetApproverId = isManager ? employee.id : null;

    // Pre-fetch doctor metadata for beat and subArea population
    const doctorIds = days.map((d) => d.plannedDoctorId).filter(Boolean) as string[];
    const doctorMeta = await db.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, beatName: true, subArea: true },
    });
    const doctorMap = new Map(doctorMeta.map((d) => [d.id, d]));

    const tourPlan = await db.$transaction(async (tx) => {
      const plan = existing
        ? await tx.tourPlan.update({
            where: { id: existing.id },
            data: { status: targetStatus, approvedById: targetApproverId },
          })
        : await tx.tourPlan.create({
            data: { employeeId: employee.id, month: normalizedMonth, status: targetStatus, approvedById: targetApproverId },
          });

      await tx.tourPlanDay.deleteMany({ where: { tourPlanId: plan.id } });
      await tx.tourPlanDay.createMany({
        data: days.map((day) => {
          const doc = day.plannedDoctorId ? doctorMap.get(day.plannedDoctorId) : null;
          return {
            tourPlanId: plan.id,
            date: startOfUtcDay(day.date),
            territoryId: day.territoryId,
            beatName: doc?.beatName ?? null,
            subArea: doc?.subArea ?? null,
            plannedDoctorId: day.plannedDoctorId,
          };
        }),
      });

      return plan;
    });

    // Dispatch interactive WhatsApp Group Vote poll and dual in-app notifications
    const dispatchResult = await TourPlanAgentsService.notifyAndDispatchWhatsAppVote(tourPlan.id);

    return ok({
      tourPlanId: tourPlan.id,
      status: tourPlan.status,
      whatsappMessage: dispatchResult.whatsappMessage,
      adminsNotified: dispatchResult.adminsNotified,
      mrNotified: dispatchResult.mrNotified,
    });
  } catch (err) {
    console.error("[POST /api/sfa/tour-plan/submit]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to submit tour plan", 500);
  }
}

export const POST = withAuth(submitTourPlan, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
