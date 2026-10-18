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
    const search = searchParams.get("search") ?? undefined;
    const territoryId = searchParams.get("territoryId") ?? undefined;
    const beatName = searchParams.get("beatName") ?? undefined;
    const specialty = searchParams.get("specialty") ?? undefined;

    const monthStart = startOfUtcMonth();

    const where: any = {
      ...(tier && tier !== "ALL" && tier !== "GAPS" ? { dpsTier: tier } : {}),
      ...(territoryId ? { territoryId } : {}),
      ...(beatName ? { beatName: { contains: beatName, mode: "insensitive" } } : {}),
      ...(specialty ? { primarySpecialty: { contains: specialty, mode: "insensitive" } } : {}),
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { primarySpecialty: { contains: search, mode: "insensitive" } },
        { clinicAddress: { contains: search, mode: "insensitive" } },
        { subArea: { contains: search, mode: "insensitive" } },
        { beatName: { contains: search, mode: "insensitive" } },
      ];
    }

    const doctors = await db.doctor.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        primarySpecialty: true,
        secondarySpecialty: true,
        qualification: true,
        clinicAddress: true,
        subArea: true,
        beatName: true,
        dpsScore: true,
        dpsTier: true,
        requiredMonthlyVisits: true,
        dpsCalculatedAt: true,
        intelligenceScore: true,
        patientFootfallDaily: true,
        avgPrescriptionsDaily: true,
        influencerLevel: true,
        territory: { select: { id: true, name: true, priority: true } },
        crmProfile: {
          select: {
            prescriptionPotential: true,
            competitorIntensity: true,
            salesConversionRate: true,
            sampleRoi: true,
            lastVisitDate: true,
          },
        },
        visits: {
          select: {
            id: true,
            createdAt: true,
            cqsScore: true,
            boxesPlaced: true,
            purpose: true,
            feedback: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { dpsScore: "desc" },
    });

    // Actual visits this month per doctor
    const visitCounts = await db.visit.groupBy({
      by: ["doctorId"],
      where: { createdAt: { gte: monthStart }, doctorId: { not: null } },
      _count: { _all: true },
    });
    const visitMap = new Map(visitCounts.map((v) => [v.doctorId as string, v._count._all]));

    // Total visits count all-time per doctor
    const allTimeVisits = await db.visit.groupBy({
      by: ["doctorId"],
      where: { doctorId: { not: null } },
      _count: { _all: true },
    });
    const allTimeVisitMap = new Map(allTimeVisits.map((v) => [v.doctorId as string, v._count._all]));

    const mappedDoctors = doctors.map((d) => {
      const thisMonth = visitMap.get(d.id) ?? 0;
      const totalVisits = allTimeVisitMap.get(d.id) ?? d.visits.length;
      const scoredVisits = d.visits.filter((v) => v.cqsScore !== null);
      const lastCqs = scoredVisits.length > 0 ? scoredVisits[0].cqsScore : null;
      const totalSamples = d.visits.reduce((acc, v) => acc + (v.boxesPlaced ?? 0), 0);

      return {
        ...d,
        visitsThisMonth: thisMonth,
        totalVisits,
        visitGap: Math.max(d.requiredMonthlyVisits - thisMonth, 0),
        lastVisitDate: d.visits[0]?.createdAt ?? d.crmProfile?.lastVisitDate ?? null,
        lastCqsScore: lastCqs,
        totalSamplesGiven: totalSamples,
        adherencePercentage:
          d.requiredMonthlyVisits > 0
            ? Math.min(Math.round((thisMonth / d.requiredMonthlyVisits) * 100), 100)
            : 100,
      };
    });

    const gapPrescribersCount = mappedDoctors.filter((d) => d.visitGap > 0).length;

    let finalDoctors = mappedDoctors;
    if (tier === "GAPS") {
      finalDoctors = mappedDoctors.filter((d) => d.visitGap > 0);
    }

    // Summary calculation
    const totalDoctors = finalDoctors.length;
    const avgDpsScore =
      totalDoctors > 0
        ? Math.round((finalDoctors.reduce((acc, d) => acc + d.dpsScore, 0) / totalDoctors) * 10) / 10
        : 0;
    const tierCounts = {
      A_PLUS: finalDoctors.filter((d) => d.dpsTier === "A+").length,
      A: finalDoctors.filter((d) => d.dpsTier === "A").length,
      B: finalDoctors.filter((d) => d.dpsTier === "B").length,
      C: finalDoctors.filter((d) => d.dpsTier === "C").length,
    };
    const highPotentialCount = tierCounts.A_PLUS + tierCounts.A;

    return ok({
      doctors: finalDoctors,
      summary: {
        totalDoctors,
        avgDpsScore,
        tierCounts,
        highPotentialCount,
        gapPrescribersCount,
      },
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
