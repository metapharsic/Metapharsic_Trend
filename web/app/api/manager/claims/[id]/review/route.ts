import { db } from "@/lib/db";
import { Role, ClaimStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";

const ReviewClaimSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

/**
 * ASM audit step: PENDING_ASM -> APPROVED (goes to the distributor to
 * resolve, see web/app/api/distributor/claims/[id]/route.ts) or REJECTED
 * (terminal — chemist's claim denied, nothing further happens).
 */
async function reviewClaim(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = ReviewClaimSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim) return notFound("Claim not found");
    if (claim.status !== ClaimStatus.PENDING_ASM) {
      return badRequest(`Claim is ${claim.status.toLowerCase()} — only PENDING_ASM claims can be reviewed here`);
    }

    const updated = await db.claim.update({ where: { id }, data: { status: parsed.data.status as ClaimStatus } });
    return ok({ claim: updated });
  } catch (err) {
    console.error("[PUT /api/manager/claims/[id]/review]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to review claim", 500);
  }
}

export const PUT = withAuth(reviewClaim, [Role.ASM, Role.ADMIN]);
