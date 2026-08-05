import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { z } from "zod";

const db = new PrismaClient();

const CreateHospitalSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.coerce.number().min(-90).max(90).optional().default(0),
  longitude: z.coerce.number().min(-180).max(180).optional().default(0),
  territoryId: z.string().uuid(),
  departments: z.string().optional(),
  purchaseManager: z.string().optional(),
  medicalSuperintendent: z.string().optional(),
  bedStrength: z.coerce.number().int().min(0).optional().default(0),
  type: z.string().optional(),
});

async function getHospitals(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const territoryId = searchParams.get("territoryId") ?? undefined;
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    const where = {
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      ...(territoryId ? { territoryId } : {}),
    };

    const [hospitals, total] = await Promise.all([
      db.hospital.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          territory: { select: { id: true, name: true } },
          _count: { select: { tenders: true, formularyEntries: true } },
        },
      }),
      db.hospital.count({ where }),
    ]);

    return ok({
      hospitals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/hospitals]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch hospitals", 500);
  }
}

async function createHospital(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateHospitalSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const hospital = await db.hospital.create({ data: parsed.data });
    return created({ hospital });
  } catch (err: any) {
    if (err?.code === "P2002") return conflict("Hospital already exists");
    console.error("[POST /api/hospitals]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create hospital", 500);
  }
}

export const GET = withAuth(getHospitals, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(createHospital, [Role.ASM, Role.ADMIN]);
