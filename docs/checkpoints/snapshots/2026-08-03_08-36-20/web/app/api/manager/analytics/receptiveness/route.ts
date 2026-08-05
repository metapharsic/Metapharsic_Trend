import { NextRequest } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

const db = new PrismaClient();

const RATINGS = [
  "VERY_INTERESTED",
  "INTERESTED",
  "NEUTRAL",
  "NOT_INTERESTED",
  "DECLINED",
] as const;

type Rating = (typeof RATINGS)[number];
type ReceptivenessCountRow = {
  receptiveness: Rating | null;
  _count: { receptiveness: number };
};

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const mrId = searchParams.get("mrId") ?? undefined; // User ID
    const territoryId = searchParams.get("territoryId") ?? undefined;

    let employeeId: string | undefined = undefined;
    if (mrId) {
      const employee = await db.employee.findUnique({ where: { userId: mrId } });
      if (employee) {
        employeeId = employee.id;
      }
    }

    const baseWhere = {
      receptiveness: { not: null },
      ...(employeeId ? { employeeId } : {}),
      ...(territoryId ? { employee: { territories: { some: { id: territoryId } } } } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const rawSummary = await db.visit.groupBy({
      by: ["receptiveness"],
      where: baseWhere,
      _count: { receptiveness: true },
    });

    const summary = Object.fromEntries(
      RATINGS.map((r) => [
        r,
        (rawSummary as unknown as ReceptivenessCountRow[]).find((s) => s.receptiveness === r)?._count.receptiveness ?? 0,
      ])
    );

    // Fetch doctors and chemists visited and count
    const doctorsVisited = await db.visit.groupBy({
      by: ["doctorId", "receptiveness"],
      where: { ...baseWhere, doctorId: { not: null } },
      _count: { receptiveness: true },
    });

    const chemistsVisited = await db.visit.groupBy({
      by: ["chemistId", "receptiveness"],
      where: { ...baseWhere, chemistId: { not: null } },
      _count: { receptiveness: true },
    });

    // Resolve names for doctors
    const doctorIds = [...new Set(doctorsVisited.map((d) => d.doctorId as string))];
    const doctors = await db.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, fullName: true },
    });

    const byDoctor = doctors.map((doc) => {
      const rows = doctorsVisited.filter((d) => d.doctorId === doc.id);
      const counts = Object.fromEntries(
        RATINGS.map((r) => [
          r,
          rows.find((row) => row.receptiveness === r)?._count.receptiveness ?? 0,
        ])
      );
      return {
        entityId: doc.id,
        entityName: doc.fullName,
        entityType: "DOCTOR",
        ...counts,
        totalVisits: rows.reduce((acc, r) => acc + (r._count.receptiveness || 0), 0),
      };
    });

    // Resolve names for chemists
    const chemistIds = [...new Set(chemistsVisited.map((c) => c.chemistId as string))];
    const chemists = await db.chemist.findMany({
      where: { id: { in: chemistIds } },
      select: { id: true, name: true },
    });

    const byChemist = chemists.map((chem) => {
      const rows = chemistsVisited.filter((c) => c.chemistId === chem.id);
      const counts = Object.fromEntries(
        RATINGS.map((r) => [
          r,
          rows.find((row) => row.receptiveness === r)?._count.receptiveness ?? 0,
        ])
      );
      return {
        entityId: chem.id,
        entityName: chem.name,
        entityType: "CHEMIST",
        ...counts,
        totalVisits: rows.reduce((acc, r) => acc + (r._count.receptiveness || 0), 0),
      };
    });

    const byEntity = [...byDoctor, ...byChemist].sort((a, b) => b.totalVisits - a.totalVisits).slice(0, 50);

    return ok({
      disclaimer:
        "Self-reported receptiveness data — lead indicator only, not tied to MR incentives or confirmed sales.",
      summary,
      byEntity,
    });
  } catch (err) {
    console.error("[GET /api/manager/analytics/receptiveness]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch receptiveness data", 500);
  }
}

export const GET = withAuth(handler, [Role.ASM, Role.ADMIN]);
