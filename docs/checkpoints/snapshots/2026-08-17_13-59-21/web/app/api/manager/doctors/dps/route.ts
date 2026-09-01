import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { runDpsScoring } from "@/jobs/dps-scoring";
import { startOfUtcMonth } from "@/lib/date";


async function getDpsScores(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier") ?? undefined;

    const monthStart = startOfUtcMonth();

    const doctors = await db.doctor.findMany({
      where: { ...(tier ? { dpsTier: tier } : {}) },
      select: {
        id: true,
        fullName: true,
        primarySpecialty: true,
        dpsScore: true,
        dpsTier: true,
        requiredMonthlyVisits: true,
        dpsCalculatedAt: true,
        territory: { select: { id: true, name: true, priority: true } },
      },
      orderBy: { dpsScore: "desc" },
    });

    // Actual visits this month per doctor, to show adherence against the required frequency.
    const visitCounts = await db.visit.groupBy({
      by: ["doctorId"],
      where: { createdAt: { gte: monthStart }, doctorId: { not: null } },
      _count: { _all: true },
    });
    const visitMap = new Map(visitCounts.map((v) => [v.doctorId as string, v._count._all]));

    return ok({
      doctors: doctors.map((d) => ({
        ...d,
        visitsThisMonth: visitMap.get(d.id) ?? 0,
        visitGap: Math.max(d.requiredMonthlyVisits - (visitMap.get(d.id) ?? 0), 0),
      })),
    });
  } catch (err) {
    console.error("[GET /api/manager/doctors/dps]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch DPS scores", 500);
  }
}

async function recalculateDps(req: AuthedRequest) {
  try {
    const updated = await runDpsScoring();
    return ok({ updated });
  } catch (err) {
    console.error("[POST /api/manager/doctors/dps]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to recalculate DPS scores", 500);
  }
}

export const GET = withAuth(getDpsScores, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
export const POST = withAuth(recalculateDps, [Role.ASM, Role.ADMIN, Role.MD]);
