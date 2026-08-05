import { PrismaClient, Role, TenderStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import { z } from "zod";

const db = new PrismaClient();

const CreateTenderSchema = z.object({
  hospitalId: z.string().uuid(),
  productId: z.string().uuid(),
  tenderNo: z.string().min(1),
  contractRate: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(0).optional().default(0),
  status: z.nativeEnum(TenderStatus).optional().default(TenderStatus.DRAFT),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
});

const UpdateTenderStatusSchema = z.object({
  tenderId: z.string().uuid(),
  status: z.nativeEnum(TenderStatus),
});

async function getTenders(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hospitalId = searchParams.get("hospitalId") ?? undefined;
    const status = searchParams.get("status") as TenderStatus | null;

    const tenders = await db.hospitalTender.findMany({
      where: {
        ...(hospitalId ? { hospitalId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        hospital: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, mrp: true } },
      },
      orderBy: { validTo: "desc" },
    });

    return ok({ tenders });
  } catch (err) {
    console.error("[GET /api/hospitals/tenders]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch tenders", 500);
  }
}

async function createTender(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateTenderSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    if (parsed.data.validTo < parsed.data.validFrom) {
      return badRequest("validTo must be on or after validFrom");
    }

    const tender = await db.hospitalTender.create({ data: parsed.data });
    return created({ tender });
  } catch (err: any) {
    if (err?.code === "P2002") return conflict("A tender with this number already exists");
    console.error("[POST /api/hospitals/tenders]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create tender", 500);
  }
}

async function updateTenderStatus(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateTenderStatusSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const tender = await db.hospitalTender.update({
      where: { id: parsed.data.tenderId },
      data: { status: parsed.data.status },
    });
    return ok({ tender });
  } catch (err) {
    console.error("[PUT /api/hospitals/tenders]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update tender", 500);
  }
}

export const GET = withAuth(getTenders, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(createTender, [Role.ASM, Role.ADMIN]);
export const PUT = withAuth(updateTenderStatus, [Role.ASM, Role.ADMIN]);
