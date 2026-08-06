import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError, badRequest, forbidden, notFound } from "@/lib/api-response";
import { startOfUtcDay, addUtcDays } from "@/lib/date";

type Period = "daily" | "weekly" | "monthly";

function periodRange(period: Period, anchor: Date): { start: Date; end: Date } {
  if (period === "daily") {
    const start = startOfUtcDay(anchor);
    return { start, end: addUtcDays(start, 1) };
  }
  if (period === "weekly") {
    const day = startOfUtcDay(anchor);
    const dow = day.getUTCDay(); // 0=Sun
    const diffToMonday = (dow + 6) % 7;
    const start = addUtcDays(day, -diffToMonday);
    return { start, end: addUtcDays(start, 7) };
  }
  // monthly
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  return { start, end };
}

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") ?? "daily") as Period;
    if (!["daily", "weekly", "monthly"].includes(period)) {
      return badRequest("period must be daily, weekly, or monthly");
    }
    const dateParam = searchParams.get("date"); // YYYY-MM-DD, defaults to today
    const anchor = dateParam ? new Date(`${dateParam}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(anchor.getTime())) return badRequest("Invalid date");

    const requestedEmployeeId = searchParams.get("employeeId");
    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN;
    if (requestedEmployeeId && !isManager) return forbidden("You may only view your own report");

    const employee = requestedEmployeeId
      ? await db.employee.findUnique({ where: { id: requestedEmployeeId } })
      : await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return requestedEmployeeId ? notFound("Employee not found") : unauthorized("Employee record not found");

    const { start, end } = periodRange(period, anchor);

    const visits = await db.visit.findMany({
      where: { employeeId: employee.id, createdAt: { gte: start, lt: end } },
      select: {
        id: true,
        purpose: true,
        createdAt: true,
        durationMinutes: true,
        boxesPlaced: true,
        cqsScore: true,
        doctorId: true,
        chemistId: true,
        doctor: { select: { fullName: true } },
        chemist: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const byDay: Record<string, number> = {};
    for (const v of visits) {
      const day = v.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const doctorCalls = visits.filter((v) => v.doctorId).length;
    const chemistCalls = visits.filter((v) => v.chemistId).length;
    const totalBoxesPlaced = visits.reduce((sum, v) => sum + (v.boxesPlaced ?? 0), 0);
    const avgDuration = visits.length
      ? Math.round(visits.reduce((sum, v) => sum + (v.durationMinutes ?? 0), 0) / visits.length)
      : 0;
    const cqsScores = visits.map((v) => v.cqsScore).filter((s): s is number => s !== null);
    const avgCqs = cqsScores.length ? Math.round((cqsScores.reduce((a, b) => a + b, 0) / cqsScores.length) * 10) / 10 : null;

    return ok({
      period,
      range: { start: start.toISOString(), end: end.toISOString() },
      employee: { id: employee.id, name: `${employee.firstName} ${employee.lastName}` },
      totals: {
        totalCalls: visits.length,
        doctorCalls,
        chemistCalls,
        totalBoxesPlaced,
        avgDurationMinutes: avgDuration,
        avgCqsScore: avgCqs,
      },
      byDay,
      calls: visits.map((v) => ({
        id: v.id,
        name: v.doctor?.fullName ?? v.chemist?.name ?? "Unknown",
        purpose: v.purpose,
        createdAt: v.createdAt.toISOString(),
        durationMinutes: v.durationMinutes,
        boxesPlaced: v.boxesPlaced,
      })),
    });
  } catch (err) {
    console.error("[GET /api/mr/reports/calls]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to generate call report", 500);
  }
}

export const GET = withAuth(handler, [Role.MR, Role.ASM, Role.ADMIN]);
