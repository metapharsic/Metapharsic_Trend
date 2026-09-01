import { db } from "@/lib/db";
import { Role, ClaimStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, unauthorized, forbidden, apiError } from "@/lib/api-response";

/**
 * MR's "I've audited this, send it to ASM" step. Only the raising MR, and
 * only while still PENDING_MR — once it's with the ASM, edits go through
 * that review, not back through the MR.
 */
async function submitClaim(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim) return notFound("Claim not found");
    if (claim.employeeId !== employee.id) return forbidden("You may only submit claims you raised yourself");
    if (claim.status !== ClaimStatus.PENDING_MR) {
      return badRequest(`Claim is ${claim.status.toLowerCase()} — only PENDING_MR claims can be submitted`);
    }

    const updated = await db.claim.update({ where: { id }, data: { status: ClaimStatus.PENDING_ASM } });
    return ok({ claim: updated });
  } catch (err) {
    console.error("[PUT /api/mr/claims/[id]/submit]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to submit claim", 500);
  }
}

export const PUT = withAuth(submitClaim, [Role.MR]);
