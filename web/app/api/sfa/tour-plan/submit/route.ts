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

    // In the day-by-day MR workflow, reps submit their schedule day-by-day.
    // If a plan already exists for this month (even if approved or pending), allow appending/updating the day's itinerary.
    const isManager = req.user.role === Role.ADMIN || req.user.role === Role.MD;
    
    // Determine target status: preserve approved status if already approved, or approve if manager
    let targetStatus: TourPlanStatus = TourPlanStatus.PENDING_ASM;
    let targetApproverId: string | null = null;

    if (isManager) {
      targetStatus = TourPlanStatus.APPROVED;
      targetApproverId = employee.id;
    } else if (existing?.status === TourPlanStatus.APPROVED) {
      targetStatus = TourPlanStatus.APPROVED;
      targetApproverId = existing.approvedById || employee.id;
    } else if (existing?.status === TourPlanStatus.PENDING_ASM) {
      targetStatus = TourPlanStatus.PENDING_ASM;
      targetApproverId = null;
    }

    // Pre-fetch doctor and chemist metadata for beat, subArea, and chemist tag population
    const doctorIds = days.map((d) => d.plannedDoctorId).filter(Boolean) as string[];
    const chemistIds = days.map((d) => d.plannedChemistId).filter(Boolean) as string[];

    const [doctorMeta, chemistMeta] = await Promise.all([
      doctorIds.length > 0
        ? db.doctor.findMany({
            where: { id: { in: doctorIds } },
            select: { id: true, beatName: true, subArea: true },
          })
        : Promise.resolve([]),
      chemistIds.length > 0
        ? db.chemist.findMany({
            where: { id: { in: chemistIds } },
            select: { id: true, name: true, address: true, beatName: true, subArea: true, mobile: true },
          })
        : Promise.resolve([]),
    ]);

    const doctorMap = new Map(doctorMeta.map((d) => [d.id, d]));
    const chemistMap = new Map(chemistMeta.map((c) => [c.id, c]));

    // Unique dates targeted by this submission
    const submittedDates = Array.from(
      new Set(days.map((d) => startOfUtcDay(d.date).getTime()))
    ).map((t) => new Date(t));

    const tourPlan = await db.$transaction(async (tx) => {
      const plan = existing
        ? await tx.tourPlan.update({
            where: { id: existing.id },
            data: { status: targetStatus, approvedById: targetApproverId },
          })
        : await tx.tourPlan.create({
            data: { employeeId: employee.id, month: normalizedMonth, status: targetStatus, approvedById: targetApproverId },
          });

      // Selectively replace only the submitted dates so existing days of the month are preserved
      await tx.tourPlanDay.deleteMany({
        where: {
          tourPlanId: plan.id,
          date: { in: submittedDates },
        },
      });

      await tx.tourPlanDay.createMany({
        data: days.map((day) => {
          const doc = day.plannedDoctorId ? doctorMap.get(day.plannedDoctorId) : null;
          const chem = !day.plannedDoctorId && day.plannedChemistId ? chemistMap.get(day.plannedChemistId) : null;

          if (chem) {
            const tag = `[Chemist Visit: ${chem.name}]<!--PLANNED_CHEMIST:${JSON.stringify({
              id: chem.id,
              name: chem.name,
              address: chem.address,
              subArea: chem.subArea,
              mobile: chem.mobile,
            })}-->`;
            return {
              tourPlanId: plan.id,
              date: startOfUtcDay(day.date),
              territoryId: day.territoryId,
              beatName: day.beatName ?? chem.beatName ?? null,
              subArea: day.subArea ?? chem.subArea ?? null,
              plannedDoctorId: null,
              visitStatus: "PENDING",
              isCompleted: false,
              completionNotes: `${tag} ${day.notes || ""}`.trim(),
            };
          }

          return {
            tourPlanId: plan.id,
            date: startOfUtcDay(day.date),
            territoryId: day.territoryId,
            beatName: day.beatName ?? doc?.beatName ?? null,
            subArea: day.subArea ?? doc?.subArea ?? null,
            plannedDoctorId: day.plannedDoctorId ?? null,
            visitStatus: "PENDING",
            isCompleted: false,
            completionNotes: day.notes || null,
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
