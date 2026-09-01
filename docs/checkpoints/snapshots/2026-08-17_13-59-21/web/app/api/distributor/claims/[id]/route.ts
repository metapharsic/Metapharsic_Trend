import { db } from "@/lib/db";
import { Role, ClaimStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, apiError } from "@/lib/api-response";
import { z } from "zod";

const ResolveClaimSchema = z.object({
  status: z.enum(["COMPLETED", "REJECTED"]),
  creditNoteAmount: z.coerce.number().min(0).optional(),
});

/**
 * The only claim mutation a distributor can make: resolving one already
 * approved by ASM/ADMIN. Distributors never touch PENDING_MR/PENDING_ASM —
 * those stages belong to the MR/ASM audit flow this route doesn't implement.
 */
async function resolveClaim(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = ResolveClaimSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim) return notFound("Claim not found");

    if (req.user.role === Role.DISTRIBUTOR) {
      const distributor = await db.distributor.findUnique({ where: { userId: req.user.sub } });
      if (!distributor || claim.distributorId !== distributor.id) {
        return forbidden("This claim does not belong to your account");
      }
    }

    if (claim.status !== ClaimStatus.APPROVED) {
      return badRequest(`Claim is ${claim.status.toLowerCase()} — only APPROVED claims can be resolved`);
    }

    const updated = await db.$transaction(async (tx) => {
      const c = await tx.claim.update({
        where: { id },
        data: { status: parsed.data.status as ClaimStatus },
      });

      if (parsed.data.status === "COMPLETED" && parsed.data.creditNoteAmount) {
        await tx.creditNote.create({
          data: {
            claimId: c.id,
            number: `CN-${c.id.slice(0, 8).toUpperCase()}`,
            amount: parsed.data.creditNoteAmount,
          },
        });
      }

      return c;
    });

    return ok({ claim: updated });
  } catch (err) {
    console.error("[PUT /api/distributor/claims/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to resolve claim", 500);
  }
}

export const PUT = withAuth(resolveClaim, [Role.DISTRIBUTOR, Role.ADMIN]);
