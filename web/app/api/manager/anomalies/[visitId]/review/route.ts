import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role, AnomalyReviewStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";


const AnomalyReviewBodySchema = z.object({
  status: z.nativeEnum(AnomalyReviewStatus),
  reviewNotes: z.string().optional(),
});

async function handler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const visitId = String(params.visitId ?? "");
    const body = await req.json();
    const parsed = AnomalyReviewBodySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const visit = await db.visit.findUnique({ where: { id: visitId } });
    if (!visit) return notFound("Visit not found");
    if (!visit.anomalyFlag) return badRequest("Visit is not flagged as anomalous");

    const existingReview = await db.anomalyReview.findFirst({ where: { visitId } });

    const review = await db.anomalyReview.upsert({
      where: {
        id: existingReview?.id ?? "new_review_id_placeholder",
      },
      update: {
        status: parsed.data.status,
        reviewNotes: parsed.data.reviewNotes ?? null,
        reviewedAt: new Date(),
        reviewerId: req.user.sub,
      },
      create: {
        visitId,
        reviewerId: req.user.sub,
        status: parsed.data.status,
        reviewNotes: parsed.data.reviewNotes ?? null,
      },
    });

    return ok({ review });
  } catch (err) {
    console.error("[POST /api/manager/anomalies/[visitId]/review]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to submit review", 500);
  }
}

export const POST = withAuth(handler, [Role.ASM, Role.ADMIN, Role.MD]);
