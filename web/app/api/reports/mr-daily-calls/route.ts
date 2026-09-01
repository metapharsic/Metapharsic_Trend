import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mrId = searchParams.get("mrId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const search = searchParams.get("search") ?? "";

    // Date range: default to today (UTC)
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const defaultEnd = new Date(defaultStart.getTime() + 86400000);

    const startDate = startDateParam ? new Date(`${startDateParam}T00:00:00.000Z`) : defaultStart;
    const endDate = endDateParam ? new Date(`${endDateParam}T23:59:59.999Z`) : defaultEnd;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return badRequest("Invalid date format. Use YYYY-MM-DD.");
    }

    // Role scoping: MR sees only their own data
    const isSelfOnly = req.user.role === Role.MR;
    let scopeEmployeeId: string | undefined;

    if (isSelfOnly) {
      const emp = await db.employee.findUnique({
        where: { userId: req.user.sub },
        select: { id: true },
      });
      if (!emp) return badRequest("Employee record not found");
      scopeEmployeeId = emp.id;
    } else if (mrId) {
      scopeEmployeeId = mrId;
    }

    // Fetch visits with full timestamps, including seconds-level precision
    const visits = await db.visit.findMany({
      where: {
        ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}),
        createdAt: { gte: startDate, lt: endDate },
        ...(search.length >= 2
          ? {
              employee: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      select: {
        id: true,
        purpose: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        durationMinutes: true,
        boxesPlaced: true,
        cqsScore: true,
        doctorId: true,
        chemistId: true,
        hospitalId: true,
        doctor: { select: { fullName: true } },
        chemist: { select: { name: true } },
        hospital: { select: { name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ employeeId: "asc" }, { createdAt: "asc" }],
    });

    // Get all MRs for selector dropdown (managers only)
    let allMrs: { id: string; firstName: string; lastName: string }[] = [];
    if (!isSelfOnly) {
      allMrs = await db.employee.findMany({
        where: { user: { role: Role.MR, isActive: true } },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      });
    }

    // Group by MR → date with full timestamp
    type CallRow = {
      id: string;
      entityName: string;
      purpose: string;
      type: "DOCTOR" | "CHEMIST" | "HOSPITAL" | "OTHER";
      startedAt: string; // full ISO with seconds
      endedAt: string | null;
      durationMinutes: number | null;
      durationSeconds: number | null;
      boxesPlaced: number | null;
      cqsScore: number | null;
    };

    type DayGroup = {
      date: string; // YYYY-MM-DD
      calls: CallRow[];
      totalCalls: number;
    };

    type MrGroup = {
      mrId: string;
      mrName: string;
      totalCalls: number;
      days: DayGroup[];
    };

    const byMr = new Map<string, MrGroup>();

    for (const v of visits) {
      const mrKey = v.employee.id;
      const mrName = `${v.employee.firstName} ${v.employee.lastName}`;

      const timestamp = v.startedAt ?? v.createdAt;
      const dateKey = timestamp.toISOString().slice(0, 10);

      // Compute duration in seconds from startedAt/endedAt if available
      let durationSeconds: number | null = null;
      if (v.startedAt && v.endedAt) {
        durationSeconds = Math.round((v.endedAt.getTime() - v.startedAt.getTime()) / 1000);
      } else if (v.durationMinutes != null) {
        durationSeconds = v.durationMinutes * 60;
      }

      const entityName =
        v.doctor?.fullName ?? v.chemist?.name ?? v.hospital?.name ?? "Unknown";
      const callType: CallRow["type"] = v.doctorId
        ? "DOCTOR"
        : v.chemistId
        ? "CHEMIST"
        : v.hospitalId
        ? "HOSPITAL"
        : "OTHER";

      const callRow: CallRow = {
        id: v.id,
        entityName,
        purpose: v.purpose,
        type: callType,
        startedAt: timestamp.toISOString(),
        endedAt: v.endedAt?.toISOString() ?? null,
        durationMinutes: v.durationMinutes,
        durationSeconds,
        boxesPlaced: v.boxesPlaced,
        cqsScore: v.cqsScore != null ? Number(v.cqsScore) : null,
      };

      if (!byMr.has(mrKey)) {
        byMr.set(mrKey, { mrId: mrKey, mrName, totalCalls: 0, days: [] });
      }
      const mrGroup = byMr.get(mrKey)!;
      mrGroup.totalCalls++;

      const dayGroup = mrGroup.days.find((d) => d.date === dateKey);
      if (dayGroup) {
        dayGroup.calls.push(callRow);
        dayGroup.totalCalls++;
      } else {
        mrGroup.days.push({ date: dateKey, calls: [callRow], totalCalls: 1 });
      }
    }

    return ok({
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalVisits: visits.length,
        totalMrs: byMr.size,
      },
      mrs: [...byMr.values()],
      allMrs: allMrs.map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
      })),
    });
  } catch (err) {
    console.error("[GET /api/reports/mr-daily-calls]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to generate MR daily calls report", 500);
  }
}

export const GET = withAuth(handler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
]);
