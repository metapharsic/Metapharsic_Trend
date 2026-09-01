import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";
import { z } from "zod";


const COMPLETION_THRESHOLD = 100;
const QUIZ_PASS_MARK = 60;

const UpsertEnrollmentSchema = z.object({
  courseId: z.string().uuid(),
  progressPercent: z.coerce.number().int().min(0).max(100).optional(),
  quizScore: z.coerce.number().int().min(0).max(100).optional(),
});

async function getEnrollments(req: AuthedRequest) {
  try {
    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN;

    let where: Record<string, unknown> = {};
    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      where = { employeeId: employee.id };
    }

    const enrollments = await db.lMSEnrollment.findMany({
      where,
      include: {
        course: { select: { id: true, title: true, description: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return ok({ enrollments });
  } catch (err) {
    console.error("[GET /api/lms/enrollments]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch enrollments", 500);
  }
}

/**
 * Enrolls the caller in a course, or advances their progress/quiz score.
 * A course counts as completed only at full progress AND a passing quiz score,
 * since completion percentages feed appraisal grades (docs Phase 4 Week 14).
 */
async function upsertEnrollment(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const body = await req.json();
    const parsed = UpsertEnrollmentSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { courseId, progressPercent, quizScore } = parsed.data;

    const existing = await db.lMSEnrollment.findUnique({
      where: { employeeId_courseId: { employeeId: employee.id, courseId } },
    });

    const nextProgress = progressPercent ?? existing?.progressPercent ?? 0;
    const nextQuizScore = quizScore ?? existing?.quizScore ?? null;
    const completed =
      nextProgress >= COMPLETION_THRESHOLD && (nextQuizScore ?? 0) >= QUIZ_PASS_MARK;

    const enrollment = await db.lMSEnrollment.upsert({
      where: { employeeId_courseId: { employeeId: employee.id, courseId } },
      update: {
        progressPercent: nextProgress,
        quizScore: nextQuizScore,
        completed,
        completedAt: completed ? existing?.completedAt ?? new Date() : null,
      },
      create: {
        employeeId: employee.id,
        courseId,
        progressPercent: nextProgress,
        quizScore: nextQuizScore,
        completed,
        completedAt: completed ? new Date() : null,
      },
      include: { course: { select: { id: true, title: true } } },
    });

    return ok({ enrollment });
  } catch (err) {
    console.error("[POST /api/lms/enrollments]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update enrollment", 500);
  }
}

export const GET = withAuth(getEnrollments, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(upsertEnrollment, [Role.MR, Role.ASM, Role.ADMIN]);
