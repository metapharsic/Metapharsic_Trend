import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, forbidden, notFound, unauthorized, apiError } from "@/lib/api-response";
import { z } from "zod";

const PruneAutoSchema = z.object({
  tourPlanId: z.string().uuid(),
});

/**
 * POST /api/sfa/tour-plan/prune-auto
 * Removes unexecuted boilerplate single-stop days (created by legacy full-month auto-provisioning)
 * so a tour plan starts cleanly in progressive N+1 mode, while strictly preserving any completed,
 * marked, multi-stop, or annotated field days.
 */
async function handlePruneAutoDays(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = PruneAutoSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid tourPlanId", parsed.error.flatten());

    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const plan = await db.tourPlan.findUnique({
      where: { id: parsed.data.tourPlanId },
      include: { days: true },
    });
    if (!plan) return notFound("Tour plan not found");

    const isManager =
      req.user.role === Role.ADMIN || req.user.role === Role.MD || req.user.role === Role.ASM;
    if (!isManager && plan.employeeId !== employee.id) {
      return forbidden("You can only convert your own tour plan to N+1 mode");
    }

    // Group stops by UTC date string
    const byDate = new Map<string, typeof plan.days>();
    for (const day of plan.days) {
      const dateKey = day.date.toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(day);
    }

    // Only delete unexecuted single-entry dates with no notes/chemists/actions (classic 27-day boilerplate)
    const idsToDelete: string[] = [];
    for (const entries of byDate.values()) {
      if (entries.length === 1) {
        const entry = entries[0];
        const isUntouched =
          !entry.isCompleted &&
          entry.visitStatus === "PENDING" &&
          (!entry.completionNotes || entry.completionNotes.trim() === "");
        if (isUntouched) {
          idsToDelete.push(entry.id);
        }
      }
    }

    if (idsToDelete.length > 0) {
      await db.tourPlanDay.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    const remainingCount = plan.days.length - idsToDelete.length;

    return ok({
      tourPlanId: plan.id,
      prunedStops: idsToDelete.length,
      remainingStops: remainingCount,
    });
  } catch (err) {
    console.error("[POST /api/sfa/tour-plan/prune-auto]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to convert plan to N+1 mode", 500);
  }
}

export const POST = withAuth(handlePruneAutoDays, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
