import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { UpdateCollectionSchema } from "@/lib/validators";
import { ok, forbidden, notFound, apiError, badRequest } from "@/lib/api-response";
import { postAutoLedger, reverseAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";
import { CreditAgentsService } from "@/services/credit-agents.service";

async function updateCollection(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const collection = await db.collection.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!collection) return notFound("Collection not found");
    if (collection.employee.userId !== req.user.sub && req.user.role === Role.MR) return forbidden();

    const body = await req.json();
    const parsed = UpdateCollectionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const updated = await db.$transaction(async (tx) => {
      const c = await tx.collection.update({
        where: { id },
        data: parsed.data,
        include: { chemist: { select: { id: true, name: true } } },
      });

      await reverseAutoLedger(tx, "COLLECTION", c.id);
      await postAutoLedger(tx, {
        sourceType: "COLLECTION",
        sourceId: c.id,
        date: c.createdAt,
        narration: `Collection from ${c.chemist.name}${c.refNumber ? ` (Ref ${c.refNumber})` : ""} — edited`,
        lines: [
          { accountCode: SYSTEM_ACCOUNT_CODES.cash, debit: Number(c.amount) },
          { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, credit: Number(c.amount) },
        ],
      });

      return c;
    });
    return ok({ collection: updated });
  } catch (err) {
    console.error("[PUT /api/mr/collections/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update collection", 500);
  }
}

async function deleteCollection(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const result = await CreditAgentsService.reversePaymentCollection({
      collectionId: id,
      userId: req.user.sub,
      reason: "User payment retrieval request",
    });
    return ok(result);
  } catch (err: any) {
    console.error("[DELETE /api/mr/collections/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to retrieve/reverse collection", 500);
  }
}

export const PUT = withAuth(updateCollection, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.FINANCE,
  Role.MR,
]);

export const DELETE = withAuth(deleteCollection, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.FINANCE,
  Role.MR,
]);
