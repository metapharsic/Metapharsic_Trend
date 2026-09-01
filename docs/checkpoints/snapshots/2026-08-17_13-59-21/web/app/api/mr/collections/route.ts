import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, unauthorized, apiError } from "@/lib/api-response";
import { z } from "zod";
import { postAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";

const LogCollectionSchema = z.object({
  chemistId: z.string().uuid(),
  amount: z.coerce.number().min(0.01),
  refNumber: z.string().optional(),
});

async function getCollections(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const [collections, total] = await Promise.all([
      db.collection.findMany({
        where: { employeeId: employee.id },
        include: { chemist: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.collection.count({ where: { employeeId: employee.id } }),
    ]);

    return ok({ collections, total });
  } catch (err) {
    console.error("[GET /api/mr/collections]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch collections", 500);
  }
}

/**
 * MR logs a payment collected from a chemist against their outstanding balance.
 * Restricted to chemists within the MR's own assigned territories — an MR can't
 * record collections against a chemist they don't cover.
 */
async function logCollection(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({
      where: { userId: req.user.sub },
      include: { territories: { select: { id: true } } },
    });
    if (!employee) return unauthorized("Employee record not found");

    const body = await req.json();
    const parsed = LogCollectionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { chemistId, amount, refNumber } = parsed.data;

    const chemist = await db.chemist.findUnique({ where: { id: chemistId } });
    if (!chemist) return notFound("Chemist not found");

    const ownTerritoryIds = employee.territories.map((t) => t.id);
    if (!ownTerritoryIds.includes(chemist.territoryId)) {
      return badRequest("You may only log collections for chemists in your own territories");
    }

    const collection = await db.$transaction(async (tx) => {
      const c = await tx.collection.create({
        data: { employeeId: employee.id, chemistId, amount, refNumber },
      });

      await postAutoLedger(tx, {
        sourceType: "COLLECTION",
        sourceId: c.id,
        date: c.createdAt,
        narration: `Collection from ${chemist.name}${refNumber ? ` (Ref ${refNumber})` : ""}`,
        lines: [
          { accountCode: SYSTEM_ACCOUNT_CODES.cash, debit: Number(amount) },
          { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, credit: Number(amount) },
        ],
      });

      return c;
    });

    return created({ collection });
  } catch (err) {
    console.error("[POST /api/mr/collections]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to log collection", 500);
  }
}

export const GET = withAuth(getCollections, [Role.MR]);
export const POST = withAuth(logCollection, [Role.MR]);
