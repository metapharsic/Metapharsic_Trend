import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, unauthorized, apiError } from "@/lib/api-response";
import { z } from "zod";
import { postAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";
import { CreditAgentsService } from "@/services/credit-agents.service";

const LogCollectionSchema = z.object({
  chemistId: z.string().uuid(),
  amount: z.coerce.number().min(0.01),
  refNumber: z.string().optional(),
  invoiceId: z.string().optional(),
});

async function getCollections(req: AuthedRequest) {
  try {
    const isManager = (
      [Role.ADMIN, Role.ASM, Role.MD, Role.FINANCE, Role.NSM, Role.ZSM, Role.RM] as Role[]
    ).includes(req.user.role);

    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee && !isManager) return unauthorized("Employee record not found");

    const where = !isManager && employee ? { employeeId: employee.id } : {};

    const [collections, total] = await Promise.all([
      db.collection.findMany({
        where,
        include: {
          chemist: {
            select: {
              id: true,
              name: true,
              address: true,
              subArea: true,
              beatName: true,
              territory: { select: { id: true, name: true } },
            },
          },
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.collection.count({ where }),
    ]);

    return ok({ collections, total });
  } catch (err) {
    console.error("[GET /api/mr/collections]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch collections", 500);
  }
}

/**
 * MR or Manager logs a payment collected from a chemist against their outstanding balance.
 * Automatically attributes to booking MR or logging manager, reconciles FIFO invoice paid status,
 * and updates double-entry ledger.
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

    const { chemistId, amount, refNumber, invoiceId } = parsed.data;

    const chemist = await db.chemist.findUnique({ where: { id: chemistId } });
    if (!chemist) return notFound("Chemist not found");

    const isManager = (
      [Role.ADMIN, Role.ASM, Role.MD, Role.FINANCE, Role.NSM, Role.ZSM, Role.RM] as Role[]
    ).includes(req.user.role);

    // Scoping guard for MR: allow if in territory, or MR has orders/invoices/visits, or unassigned
    if (!isManager && req.user.role === Role.MR) {
      const ownTerritoryIds = employee.territories.map((t) => t.id);
      const hasTerritory = ownTerritoryIds.includes(chemist.territoryId);

      if (!hasTerritory && ownTerritoryIds.length > 0) {
        const hasOrder = await db.order.findFirst({
          where: { chemistId, employeeId: employee.id },
          select: { id: true },
        });
        const hasVisit = !hasOrder
          ? await db.visit.findFirst({
              where: { chemistId, employeeId: employee.id },
              select: { id: true },
            })
          : null;

        if (!hasOrder && !hasVisit) {
          return badRequest(
            "You may only log collections for chemists in your assigned territories or where you have active orders or visits"
          );
        }
      }
    }

    // Resolve optional invoice reference
    let finalRef = refNumber;
    if (invoiceId) {
      const targetInvoice = await db.invoice.findUnique({
        where: { id: invoiceId },
        select: { invoiceNo: true },
      });
      if (targetInvoice) {
        finalRef = finalRef
          ? `${finalRef} [${targetInvoice.invoiceNo}]`
          : `[${targetInvoice.invoiceNo}]`;
      }
    }

    const collection = await db.$transaction(async (tx) => {
      const c = await tx.collection.create({
        data: { employeeId: employee.id, chemistId, amount, refNumber: finalRef },
      });

      await postAutoLedger(tx, {
        sourceType: "COLLECTION",
        sourceId: c.id,
        date: c.createdAt,
        narration: `Collection from ${chemist.name}${finalRef ? ` (Ref ${finalRef})` : ""}`,
        lines: [
          { accountCode: SYSTEM_ACCOUNT_CODES.cash, debit: Number(amount) },
          { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, credit: Number(amount) },
        ],
      });

      // Synchronize and update invoice paid status in real-time
      await CreditAgentsService.reconcileChemistInvoicePaidStatus(tx, chemistId);

      return c;
    });

    return created({ collection });
  } catch (err) {
    console.error("[POST /api/mr/collections]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to log collection", 500);
  }
}

export const GET = withAuth(getCollections, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.FINANCE,
  Role.NSM,
  Role.ZSM,
  Role.RM,
]);
export const POST = withAuth(logCollection, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.FINANCE,
  Role.NSM,
  Role.ZSM,
  Role.RM,
]);
