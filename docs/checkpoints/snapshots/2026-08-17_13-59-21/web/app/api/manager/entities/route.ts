import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { z } from "zod";


const CreateEntityBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["DOCTOR", "CHEMIST", "DISTRIBUTOR", "HOSPITAL"]),
  address: z.string().min(1),
  latitude: z.number().optional().default(0.0),
  longitude: z.number().optional().default(0.0),
  territoryId: z.string().uuid(),
  // Doctor specific fields
  primarySpecialty: z.string().optional(),
  secondarySpecialty: z.string().optional(),
  whatsApp: z.string().optional(),
  // Chemist specific fields
  contactPerson: z.string().optional(),
  licenseNo: z.string().optional(),
  billingName: z.string().optional(),
  // Distributor specific fields
  gstNo: z.string().optional(),
  // Hospital specific fields
  departments: z.string().optional(),
  bedStrength: z.number().int().min(0).optional(),
  confirmDuplicate: z.boolean().optional(),
});

function normalizeEntityName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(dr|mr|mrs|ms)\.?\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getEntities(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const type = searchParams.get("type"); // DOCTOR, CHEMIST, DISTRIBUTOR, HOSPITAL, EMPLOYEE
    const territoryId = searchParams.get("territoryId") ?? undefined;
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    let entities: any[] = [];
    let total = 0;

    if (type === "DOCTOR") {
      const where = {
        ...(search ? { fullName: { contains: search, mode: "insensitive" as const } } : {}),
        ...(territoryId ? { territoryId } : {}),
      };
      const [doctors, count] = await Promise.all([
        db.doctor.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { fullName: "asc" },
        }),
        db.doctor.count({ where }),
      ]);
      entities = doctors.map((d) => ({
        id: d.id,
        name: d.fullName,
        type: "DOCTOR",
        address: d.clinicAddress,
        territoryId: d.territoryId,
        primarySpecialty: d.primarySpecialty,
        secondarySpecialty: d.secondarySpecialty,
        whatsApp: d.whatsApp,
      }));
      total = count;
    } else if (type === "CHEMIST") {
      const where = {
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        ...(territoryId ? { territoryId } : {}),
      };
      const [chemists, count] = await Promise.all([
        db.chemist.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: "asc" },
        }),
        db.chemist.count({ where }),
      ]);
      entities = chemists.map((c) => ({
        id: c.id,
        name: c.name,
        type: "CHEMIST",
        address: c.address,
        territoryId: c.territoryId,
        contactPerson: c.contactPerson,
        licenseNo: c.licenseNo,
        creditLimit: c.creditLimit !== null ? Number(c.creditLimit) : null,
        billingName: c.billingName,
        gstNo: c.gstNo,
      }));
      total = count;
    } else if (type === "DISTRIBUTOR") {
      const where = {
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        ...(territoryId ? { territoryId } : {}),
      };
      const [distributors, count] = await Promise.all([
        db.distributor.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: "asc" },
        }),
        db.distributor.count({ where }),
      ]);
      entities = distributors.map((dist) => ({
        id: dist.id,
        name: dist.name,
        type: "DISTRIBUTOR",
        address: dist.address,
        territoryId: dist.territoryId,
        gstNo: dist.gstNo,
        licenseNo: dist.licenseNo,
      }));
      total = count;
    } else if (type === "HOSPITAL") {
      const where = {
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        ...(territoryId ? { territoryId } : {}),
      };
      const [hospitals, count] = await Promise.all([
        db.hospital.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: "asc" },
        }),
        db.hospital.count({ where }),
      ]);
      entities = hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        type: "HOSPITAL",
        address: h.address,
        territoryId: h.territoryId,
        departments: h.departments,
        bedStrength: h.bedStrength,
      }));
      total = count;
    } else if (type === "EMPLOYEE") {
      const where = {
        ...(search ? { firstName: { contains: search, mode: "insensitive" as const } } : {}),
        ...(territoryId ? { territories: { some: { id: territoryId } } } : {}),
      };
      const [employees, count] = await Promise.all([
        db.employee.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { firstName: "asc" },
          include: { user: { select: { email: true, role: true } }, territories: { select: { id: true, name: true } } },
        }),
        db.employee.count({ where }),
      ]);
      entities = employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        type: "EMPLOYEE",
        address: e.territories.map((t) => t.name).join(", ") || null,
        territoryId: e.territories[0]?.id ?? null,
        role: e.user.role,
        email: e.user.email,
        phone: e.phone,
      }));
      total = count;
    } else {
      // Return combined doctors and chemists by default
      const [doctors, chemists] = await Promise.all([
        db.doctor.findMany({ take: 20 }),
        db.chemist.findMany({ take: 20 }),
      ]);
      entities = [
        ...doctors.map((d) => ({ id: d.id, name: d.fullName, type: "DOCTOR", address: d.clinicAddress, territoryId: d.territoryId })),
        ...chemists.map((c) => ({ id: c.id, name: c.name, type: "CHEMIST", address: c.address, territoryId: c.territoryId })),
      ];
      total = entities.length;
    }

    return ok({
      entities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/manager/entities]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch entities", 500);
  }
}

async function createEntity(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateEntityBodySchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const {
      name,
      type,
      address,
      latitude,
      longitude,
      territoryId,
      primarySpecialty,
      secondarySpecialty,
      whatsApp,
      contactPerson,
      licenseNo,
      billingName,
      gstNo,
      departments,
      bedStrength,
      confirmDuplicate,
    } = parsed.data;

    if (req.user.role === Role.MR) {
      if (type !== "DOCTOR" && type !== "CHEMIST") {
        return badRequest("MRs may only add doctors or chemists");
      }
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
        include: { territories: { select: { id: true } } },
      });
      const ownTerritoryIds = employee?.territories.map((t) => t.id) ?? [];
      if (!ownTerritoryIds.includes(territoryId)) {
        return badRequest("You may only add entities within your own assigned territories");
      }
    }

    if ((type === "DOCTOR" || type === "CHEMIST") && !confirmDuplicate) {
      const normalizedIncoming = normalizeEntityName(name);
      const significantWord = name
        .replace(/\b(dr|mr|mrs|ms)\.?\b/gi, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0];

      const candidates =
        type === "DOCTOR"
          ? await db.doctor.findMany({
              where: {
                territoryId,
                ...(significantWord ? { fullName: { contains: significantWord, mode: "insensitive" as const } } : {}),
              },
              select: { id: true, fullName: true },
            })
          : await db.chemist.findMany({
              where: {
                territoryId,
                ...(significantWord ? { name: { contains: significantWord, mode: "insensitive" as const } } : {}),
              },
              select: { id: true, name: true },
            });

      const match = candidates.find((c: any) => {
        const candidateName = type === "DOCTOR" ? c.fullName : c.name;
        return normalizeEntityName(candidateName) === normalizedIncoming;
      });

      if (match) {
        const matchedName = type === "DOCTOR" ? (match as any).fullName : (match as any).name;
        return apiError("DUPLICATE_ENTITY", "A similar entity already exists", 409, {
          existing: { id: match.id, name: matchedName },
        });
      }
    }

    if (type === "DOCTOR") {
      const doctor = await db.doctor.create({
        data: {
          fullName: name,
          primarySpecialty: primarySpecialty || "General Medicine",
          secondarySpecialty: secondarySpecialty || null,
          clinicAddress: address,
          latitude,
          longitude,
          territoryId,
          whatsApp: whatsApp || null,
        },
      });
      return created({
        entity: {
          id: doctor.id,
          name: doctor.fullName,
          type: "DOCTOR",
          address: doctor.clinicAddress,
          territoryId: doctor.territoryId,
          primarySpecialty: doctor.primarySpecialty,
          secondarySpecialty: doctor.secondarySpecialty,
          whatsApp: doctor.whatsApp,
        },
      });
    } else if (type === "CHEMIST") {
      const chemist = await db.chemist.create({
        data: {
          name,
          contactPerson: contactPerson || "Owner",
          address,
          latitude,
          longitude,
          territoryId,
          licenseNo,
          billingName: billingName || null,
          gstNo: gstNo || null,
        },
      });
      return created({
        entity: {
          id: chemist.id,
          name: chemist.name,
          type: "CHEMIST",
          address: chemist.address,
          territoryId: chemist.territoryId,
          contactPerson: chemist.contactPerson,
          licenseNo: chemist.licenseNo,
          billingName: chemist.billingName,
          gstNo: chemist.gstNo,
        },
      });
    } else if (type === "HOSPITAL") {
      const hospital = await db.hospital.create({
        data: {
          name,
          address,
          latitude,
          longitude,
          territoryId,
          departments: departments || null,
          bedStrength: bedStrength ?? 0,
        },
      });
      return created({
        entity: {
          id: hospital.id,
          name: hospital.name,
          type: "HOSPITAL",
          address: hospital.address,
          territoryId: hospital.territoryId,
          departments: hospital.departments,
          bedStrength: hospital.bedStrength,
        },
      });
    } else {
      const distributor = await db.distributor.create({
        data: {
          name,
          address,
          territoryId,
          gstNo: gstNo || null,
          licenseNo: licenseNo || null,
        },
      });
      return created({
        entity: {
          id: distributor.id,
          name: distributor.name,
          type: "DISTRIBUTOR",
          address: distributor.address,
          territoryId: distributor.territoryId,
          gstNo: distributor.gstNo,
          licenseNo: distributor.licenseNo,
        },
      });
    }
  } catch (err: any) {
    if (err?.code === "P2002") return conflict("Entity already exists");
    console.error("[POST /api/manager/entities]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create entity", 500);
  }
}

export const GET = withAuth(getEntities, [Role.MR, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM, Role.ADMIN]);
export const POST = withAuth(createEntity, [Role.MR, Role.ASM, Role.ADMIN]);
