import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, badRequest } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mrId = searchParams.get("mrId"); // User ID or Employee ID of MR
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return badRequest("month must be YYYY-MM");

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    let employeeId: string | undefined;
    if (mrId) {
      const employee = await db.employee.findFirst({
        where: {
          OR: [
            { userId: mrId },
            { id: mrId },
          ],
        },
        select: { id: true, userId: true },
      });
      if (!employee) return badRequest("MR not found");
      employeeId = employee.id;
    }

    const visits = await db.visit.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        createdAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        createdAt: true,
        employeeId: true,
        purpose: true,
        feedback: true,
        receptiveness: true,
        durationMinutes: true,
        cqsScore: true,
        boxesPlaced: true,
        employee: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            user: { select: { id: true, email: true } },
          },
        },
        doctor: {
          select: {
            fullName: true,
            subArea: true,
            beatName: true,
            territory: { select: { name: true } },
          },
        },
        chemist: {
          select: {
            name: true,
            subArea: true,
            beatName: true,
            territory: { select: { name: true } },
          },
        },
        hospital: {
          select: {
            name: true,
            territory: { select: { name: true } },
          },
        },
        samples: {
          select: {
            quantity: true,
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const counts: Record<string, number> = {};
    const byMr: Record<string, { name: string; userId: string; employeeId: string; total: number }> = {};
    const byDay: Record<string, any[]> = {};
    const areasSet = new Set<string>();
    const beatsSet = new Set<string>();
    let totalBoxesPlaced = 0;
    let scoredVisitsCount = 0;
    let totalCqsSum = 0;

    for (const v of visits) {
      const day = v.createdAt.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;

      const name = v.employee
        ? `${v.employee.firstName || ""} ${v.employee.lastName || ""}`.trim() || "Unknown MR"
        : "Unknown MR";
      const uId = v.employee?.user?.id || v.employee?.userId || v.employeeId;
      const eId = v.employeeId;

      if (!byMr[uId]) {
        byMr[uId] = { name, userId: uId, employeeId: eId, total: 0 };
      }
      byMr[uId].total += 1;

      // Keep employeeId key aligned to avoid lookups failing if frontend references employeeId
      if (eId !== uId && !byMr[eId]) {
        byMr[eId] = byMr[uId];
      }

      const subArea = v.doctor?.subArea || v.chemist?.subArea || "General Field";
      const beatName = v.doctor?.beatName || v.chemist?.beatName || "Unassigned Beat";
      const territoryName =
        v.doctor?.territory?.name ||
        v.chemist?.territory?.name ||
        v.hospital?.territory?.name ||
        "General Territory";

      areasSet.add(subArea);
      beatsSet.add(beatName);

      if (v.boxesPlaced && v.boxesPlaced > 0) {
        totalBoxesPlaced += v.boxesPlaced;
      }
      if (v.cqsScore !== null && v.cqsScore !== undefined) {
        scoredVisitsCount++;
        totalCqsSum += v.cqsScore;
      }

      if (!byDay[day]) byDay[day] = [];
      byDay[day].push({
        id: v.id,
        time: v.createdAt.toISOString(),
        mrName: name,
        mrUserId: uId,
        mrEmployeeId: eId,
        target: v.doctor?.fullName || v.chemist?.name || v.hospital?.name || "—",
        targetType: v.doctor ? "Doctor" : v.chemist ? "Chemist" : v.hospital ? "Hospital" : "Other",
        purpose: v.purpose,
        feedback: v.feedback,
        receptiveness: v.receptiveness,
        durationMinutes: v.durationMinutes,
        subArea,
        beatName,
        territory: territoryName,
        cqsScore: v.cqsScore,
        boxesPlaced: v.boxesPlaced,
        samples: v.samples,
      });
    }

    // Query available months with counts to power instant month switching
    let availableMonths: Array<{ month: string; count: number }> = [];
    try {
      availableMonths = await db.$queryRaw<Array<{ month: string; count: number }>>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM "Visit"
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 24;
      `;
    } catch {
      availableMonths = [];
    }

    const avgCqsScore = scoredVisitsCount > 0 ? Math.round((totalCqsSum / scoredVisitsCount) * 10) / 10 : null;

    // Field Force Gap Analytics
    const allMrs = await db.employee.findMany({
      where: { user: { role: Role.MR } },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        user: { select: { email: true } },
      },
    });

    const activeMrIds = new Set(Object.keys(byMr));
    const inactiveMrs = allMrs
      .filter((m) => !activeMrIds.has(m.userId) && !activeMrIds.has(m.id))
      .map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        email: m.user?.email || "—",
      }));

    const [yStr, mStr] = month.split("-");
    const numDaysInMonth = new Date(parseInt(yStr, 10), parseInt(mStr, 10), 0).getDate();
    const activeDaysCount = Object.keys(counts).length;
    const gapDaysCount = Math.max(0, numDaysInMonth - activeDaysCount);

    const officialBeatsList = [
      "HYD-BEAT-1: Santosh Nagar Main & IS Sadan",
      "HYD-BEAT-2: Baba Nagar & Phoolbagh",
      "HYD-BEAT-3: Yakutpura & Rein Bazar",
      "HYD-BEAT-4: Talab Katta & Saidabad",
      "HYD-BEAT-5: Charminar & Ghansi Bazar",
      "HYD-BEAT-6: Pisalbanda & Barkas",
      "HYD-BEAT-7: First Lancer & Masab Tank",
      "HYD-BEAT-8: Khilwath & Kalapathar",
      "HYD-BEAT-9: Moin Bagh & Edi Bazar",
      "HYD-BEAT-10: Chaderghat & Malakpet",
      "SEC-BEAT-1: Tarnaka Core & Lalaguda",
      "SEC-BEAT-2: Shanti Nagar & HMT Nagar",
      "SEC-BEAT-3: Lalapet & Moula Ali",
      "SEC-BEAT-4: Nacharam & Mallapur",
      "SEC-BEAT-5: VST & Musheerabad",
    ];

    const visitedBeatsSet = new Set(Array.from(beatsSet));
    const unvisitedBeats = officialBeatsList.filter((b) => !visitedBeatsSet.has(b));

    const tierAGapWhere = {
      dpsTier: "A",
      OR: [
        { visits: { none: {} } },
        { visits: { none: { createdAt: { gte: new Date(Date.now() - 15 * 86400000) } } } },
      ],
    };

    const [overdueTierADoctors, tierAGapCount, totalChemists, chemistsWithDl] = await Promise.all([
      db.doctor.findMany({
        where: tierAGapWhere,
        select: {
          id: true,
          fullName: true,
          primarySpecialty: true,
          beatName: true,
          subArea: true,
          dpsScore: true,
          visits: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
        take: 10,
      }),
      db.doctor.count({ where: tierAGapWhere }),
      db.chemist.count(),
      db.chemist.count({ where: { dlCopyUrl: { not: null } } }),
    ]);

    return ok({
      counts,
      byMr,
      byDay,
      total: visits.length,
      availableMonths,
      summaryMetrics: {
        totalCalls: visits.length,
        totalBoxesPlaced,
        avgCqsScore,
        uniqueBeatsCount: beatsSet.size,
        uniqueAreasCount: areasSet.size,
        uniqueBeats: Array.from(beatsSet).filter((b) => b !== "Unassigned Beat"),
        uniqueAreas: Array.from(areasSet).filter((a) => a !== "General Field"),
        chemistDlCompliance: {
          totalChemists,
          chemistsWithDl,
          missingDlCount: totalChemists - chemistsWithDl,
          complianceRate: Math.round((chemistsWithDl / Math.max(totalChemists, 1)) * 100),
        },
        gapAnalytics: {
          numDaysInMonth,
          activeDaysCount,
          gapDaysCount,
          inactiveMrsCount: inactiveMrs.length,
          inactiveMrs,
          unvisitedBeatsCount: unvisitedBeats.length,
          unvisitedBeats,
          tierAGapCount,
          overdueTierADoctors: overdueTierADoctors.map((d) => ({
            id: d.id,
            fullName: d.fullName,
            specialty: d.primarySpecialty,
            beatName: d.beatName,
            subArea: d.subArea,
            dpsScore: d.dpsScore,
            lastVisitDate: d.visits[0]?.createdAt ?? null,
            gapDays: d.visits[0]
              ? Math.round((Date.now() - new Date(d.visits[0].createdAt).getTime()) / 86400000)
              : null,
          })),
        },
      },
      selectedMonth: month,
    });
  } catch (err) {
    console.error("[GET /api/manager/visits/summary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch call summary", 500);
  }
}

export const GET = withAuth(handler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
]);

