import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";

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

    const isManager =
      req.user.role === Role.ADMIN ||
      req.user.role === Role.ASM ||
      req.user.role === Role.RM ||
      req.user.role === Role.ZSM ||
      req.user.role === Role.NSM ||
      req.user.role === Role.MD;

    let territoryFilter: { in: string[] } | undefined = undefined;

    if (territoryId) {
      territoryFilter = { in: [territoryId] };
    } else if (!isManager) {
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
        include: { territories: true },
      });
      const ids = employee?.territories.map((t) => t.id) || [];
      // Only restrict if MR has explicitly assigned territories; otherwise allow broad search
      if (ids.length > 0) {
        territoryFilter = { in: ids };
      }
    }

    const doctorWhere = {
      ...(territoryFilter ? { territoryId: territoryFilter } : {}),
      ...(search ? { fullName: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const chemistWhere = {
      ...(territoryFilter ? { territoryId: territoryFilter } : {}),
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
          select: {
            id: true,
            fullName: true,
            clinicAddress: true,
            territoryId: true,
            primarySpecialty: true,
            territory: { select: { id: true, name: true } },
          },
        }),
        db.doctor.count({ where: doctorWhere }),
      ]);
      entities = doctors.map((d) => ({
        id: d.id,
        name: d.fullName,
        type: "DOCTOR",
        address: d.clinicAddress,
        territoryId: d.territoryId,
        territoryName: d.territory?.name ?? null,
        primarySpecialty: d.primarySpecialty,
      }));
      total = count;
    } else if (type === "CHEMIST") {
      const [chemists, count] = await Promise.all([
        db.chemist.findMany({
          where: chemistWhere,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            address: true,
            territoryId: true,
            contactPerson: true,
            territory: { select: { id: true, name: true } },
          },
        }),
        db.chemist.count({ where: chemistWhere }),
      ]);
      entities = chemists.map((c) => ({
        id: c.id,
        name: c.name,
        type: "CHEMIST",
        address: c.address,
        territoryId: c.territoryId,
        territoryName: c.territory?.name ?? null,
        contactPerson: c.contactPerson,
      }));
      total = count;
    } else {
      // Fetch both and combine
      const [doctors, chemists] = await Promise.all([
        db.doctor.findMany({
          where: doctorWhere,
          orderBy: { fullName: "asc" },
          select: {
            id: true,
            fullName: true,
            clinicAddress: true,
            territoryId: true,
            primarySpecialty: true,
            territory: { select: { id: true, name: true } },
          },
        }),
        db.chemist.findMany({
          where: chemistWhere,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            address: true,
            territoryId: true,
            contactPerson: true,
            territory: { select: { id: true, name: true } },
          },
        }),
      ]);
      const combined = [
        ...doctors.map((d) => ({
          id: d.id,
          name: d.fullName,
          type: "DOCTOR",
          address: d.clinicAddress,
          territoryId: d.territoryId,
          territoryName: d.territory?.name ?? null,
          primarySpecialty: d.primarySpecialty,
        })),
        ...chemists.map((c) => ({
          id: c.id,
          name: c.name,
          type: "CHEMIST",
          address: c.address,
          territoryId: c.territoryId,
          territoryName: c.territory?.name ?? null,
          contactPerson: c.contactPerson,
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

export const GET = withAuth(handler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.RM,
  Role.ZSM,
  Role.NSM,
  Role.MD,
]);
