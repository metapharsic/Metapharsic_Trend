import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { z } from "zod";


const UpsertFormularySchema = z.object({
  hospitalId: z.string().uuid(),
  productId: z.string().uuid(),
  included: z.boolean(),
  notes: z.string().optional(),
});

async function getFormulary(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hospitalId = searchParams.get("hospitalId") ?? undefined;

    const entries = await db.hospitalFormulary.findMany({
      where: { ...(hospitalId ? { hospitalId } : {}) },
      include: {
        hospital: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, therapySegment: true } },
      },
      orderBy: [{ hospitalId: "asc" }, { createdAt: "desc" }],
    });

    return ok({ entries });
  } catch (err) {
    console.error("[GET /api/hospitals/formulary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch formulary", 500);
  }
}

/** Upsert so MRs can toggle inclusion status repeatedly without creating duplicates. */
async function upsertFormularyEntry(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = UpsertFormularySchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { hospitalId, productId, included, notes } = parsed.data;

    const entry = await db.hospitalFormulary.upsert({
      where: { hospitalId_productId: { hospitalId, productId } },
      update: { included, notes, reviewedAt: new Date() },
      create: { hospitalId, productId, included, notes, reviewedAt: new Date() },
      include: { product: { select: { id: true, name: true, sku: true } } },
    });

    return ok({ entry });
  } catch (err) {
    console.error("[POST /api/hospitals/formulary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update formulary entry", 500);
  }
}

export const GET = withAuth(getFormulary, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(upsertFormularyEntry, [Role.MR, Role.ASM, Role.ADMIN]);
