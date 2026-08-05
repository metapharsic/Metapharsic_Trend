import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";

const db = new PrismaClient();

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const type = searchParams.get("type"); // DOCTOR or CHEMIST
    const territoryId = searchParams.get("territoryId") ?? undefined;

    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    // 1. Resolve employee territories if not admin/manager
    let territoryIds: string[] = [];
    if (territoryId) {
      territoryIds = [territoryId];
    } else {
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
        include: { territories: true },
      });
      territoryIds = employee?.territories.map((t) => t.id) || [];
    }

    const doctorWhere = {
      territoryId: { in: territoryIds },
      ...(search ? { fullName: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const chemistWhere = {
      territoryId: { in: territoryIds },
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    let entities: any[] = [];
    let total = 0;

    if (type === "DOCTOR") {
      const [doctors, count] = await Promise.all([
        db.doctor.findMany({
          where: doctorWhere,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, clinicAddress: true, territoryId: true },
        }),
        db.doctor.count({ where: doctorWhere }),
      ]);
      entities = doctors.map((d) => ({
        id: d.id,
        name: d.fullName,
        type: "DOCTOR",
        address: d.clinicAddress,
        territoryId: d.territoryId,
      }));
      total = count;
    } else if (type === "CHEMIST") {
      const [chemists, count] = await Promise.all([
        db.chemist.findMany({
          where: chemistWhere,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: "asc" },
          select: { id: true, name: true, address: true, territoryId: true },
        }),
        db.chemist.count({ where: chemistWhere }),
      ]);
      entities = chemists.map((c) => ({
        id: c.id,
        name: c.name,
        type: "CHEMIST",
        address: c.address,
        territoryId: c.territoryId,
      }));
      total = count;
    } else {
      // Fetch both and combine
      const [doctors, chemists] = await Promise.all([
        db.doctor.findMany({ where: doctorWhere, orderBy: { fullName: "asc" } }),
        db.chemist.findMany({ where: chemistWhere, orderBy: { name: "asc" } }),
      ]);
      const combined = [
        ...doctors.map((d) => ({
          id: d.id,
          name: d.fullName,
          type: "DOCTOR",
          address: d.clinicAddress,
          territoryId: d.territoryId,
        })),
        ...chemists.map((c) => ({
          id: c.id,
          name: c.name,
          type: "CHEMIST",
          address: c.address,
          territoryId: c.territoryId,
        })),
      ];
      total = combined.length;
      entities = combined.slice((page - 1) * limit, page * limit);
    }

    return ok({
      entities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/mr/entities]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch entities", 500);
  }
}

export const GET = withAuth(handler, [Role.MR, Role.ASM, Role.ADMIN]);
