import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, unauthorized, apiError } from "@/lib/api-response";
import { startOfUtcDay } from "@/lib/date";
import { z } from "zod";

const db = new PrismaClient();

const CreateLeaveSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  type: z.string().min(1),
  reason: z.string().optional(),
});

const ReviewLeaveSchema = z.object({
  leaveRequestId: z.string().uuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
});

async function getLeaveRequests(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN;

    let where: Record<string, unknown> = { ...(status ? { status } : {}) };
    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      where = { ...where, employeeId: employee.id };
    }

    const leaveRequests = await db.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: "desc" },
    });

    return ok({ leaveRequests });
  } catch (err) {
    console.error("[GET /api/hrms/leave]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch leave requests", 500);
  }
}

async function createLeaveRequest(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const body = await req.json();
    const parsed = CreateLeaveSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const startDate = startOfUtcDay(parsed.data.startDate);
    const endDate = startOfUtcDay(parsed.data.endDate);
    if (endDate < startDate) return badRequest("endDate must be on or after startDate");

    const leaveRequest = await db.leaveRequest.create({
      data: {
        employeeId: employee.id,
        startDate,
        endDate,
        type: parsed.data.type,
        reason: parsed.data.reason,
        status: "PENDING",
      },
    });

    return created({ leaveRequest });
  } catch (err) {
    console.error("[POST /api/hrms/leave]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create leave request", 500);
  }
}

/**
 * Approving a leave also frees the MR's tour-plan days in that range, so the
 * calendar cannot demand visits on days they are on approved leave
 * (docs Phase 4 Week 15: "Approved leaves automatically freeze dates").
 */
async function reviewLeaveRequest(req: AuthedRequest) {
  try {
    const approver = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!approver) return unauthorized("Employee record not found");

    const body = await req.json();
    const parsed = ReviewLeaveSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.leaveRequest.findUnique({ where: { id: parsed.data.leaveRequestId } });
    if (!existing) return notFound("Leave request not found");
    if (existing.status !== "PENDING") {
      return badRequest("Only pending leave requests can be reviewed");
    }

    const leaveRequest = await db.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: existing.id },
        data: { status: parsed.data.status, approvedById: approver.id },
      });

      if (parsed.data.status === "APPROVED") {
        await tx.tourPlanDay.deleteMany({
          where: {
            tourPlan: { employeeId: existing.employeeId },
            date: { gte: existing.startDate, lte: existing.endDate },
          },
        });
      }

      return updated;
    });

    return ok({ leaveRequest });
  } catch (err) {
    console.error("[PUT /api/hrms/leave]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to review leave request", 500);
  }
}

export const GET = withAuth(getLeaveRequests, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(createLeaveRequest, [Role.MR, Role.ASM, Role.ADMIN]);
export const PUT = withAuth(reviewLeaveRequest, [Role.ASM, Role.ADMIN]);
