import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { UpdateLedgerSchema } from "@/lib/validators";
import { ok, notFound, apiError, badRequest } from "@/lib/api-response";

async function updateLedger(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const ledger = await db.entityLedger.findUnique({ where: { id } });
    if (!ledger) return notFound("Ledger entry not found");

    const body = await req.json();
    const parsed = UpdateLedgerSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const updated = await db.entityLedger.update({ where: { id }, data: parsed.data });
    return ok({ ledger: updated });
  } catch (err) {
    console.error("[PUT /api/manager/ledgers/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update ledger entry", 500);
  }
}

async function deleteLedger(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const ledger = await db.entityLedger.findUnique({ where: { id } });
    if (!ledger) return notFound("Ledger entry not found");

    await db.entityLedger.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    console.error("[DELETE /api/manager/ledgers/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete ledger entry", 500);
  }
}

export const PUT = withAuth(updateLedger, [Role.ADMIN]);
export const DELETE = withAuth(deleteLedger, [Role.ADMIN]);
