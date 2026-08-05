import { NextRequest } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { z } from "zod";

const db = new PrismaClient();

const CreateEntityBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["DOCTOR", "CHEMIST"]),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  territoryId: z.string().uuid(),
  // Doctor optional fields
  primarySpecialty: z.string().optional(),
  // Chemist optional fields
  contactPerson: z.string().optional(),
  licenseNo: z.string().optional(),
});

async function getEntities(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const type = searchParams.get("type"); // DOCTOR or CHEMIST
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
      }));
      total = count;
    } else {
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
      }));
      total = count;
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

    const { name, type, address, latitude, longitude, territoryId, primarySpecialty, contactPerson, licenseNo } = parsed.data;

    if (type === "DOCTOR") {
      const doctor = await db.doctor.create({
        data: {
          fullName: name,
          primarySpecialty: primarySpecialty || "General Medicine",
          clinicAddress: address,
          latitude,
          longitude,
          territoryId,
        },
      });
      return created({
        entity: {
          id: doctor.id,
          name: doctor.fullName,
          type: "DOCTOR",
          address: doctor.clinicAddress,
          territoryId: doctor.territoryId,
        },
      });
    } else {
      const chemist = await db.chemist.create({
        data: {
          name,
          contactPerson: contactPerson || "Owner",
          address,
          latitude,
          longitude,
          territoryId,
          licenseNo,
        },
      });
      return created({
        entity: {
          id: chemist.id,
          name: chemist.name,
          type: "CHEMIST",
          address: chemist.address,
          territoryId: chemist.territoryId,
        },
      });
    }
  } catch (err: any) {
    if (err?.code === "P2002") return conflict("Entity already exists");
    console.error("[POST /api/manager/entities]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create entity", 500);
  }
}

export const GET = withAuth(getEntities, [Role.ASM, Role.ADMIN]);
export const POST = withAuth(createEntity, [Role.ASM, Role.ADMIN]);
