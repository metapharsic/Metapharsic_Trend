import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, apiError } from "@/lib/api-response";
import { outstandingBalance, creditStatus, round2 } from "@/lib/credit";

/**
 * GET /api/orders/booking-context?chemistId=<uuid>
 * Returns active discount schemes for order preview and, when chemistId is supplied,
 * the chemist's real-time credit limit, exposure, and remaining headroom.
 */
async function getBookingContext(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chemistId = searchParams.get("chemistId")?.trim() || undefined;
    const now = new Date();

    const activeSchemesPromise = db.discountScheme.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validTo: { gte: now },
      },
      select: {
        id: true,
        name: true,
        productId: true,
        minQuantity: true,
        discountPct: true,
        validFrom: true,
        validTo: true,
      },
      orderBy: [{ discountPct: "desc" }, { minQuantity: "asc" }],
    });

    if (!chemistId) {
      const activeSchemes = await activeSchemesPromise;
      return ok({ activeSchemes, chemistCredit: null });
    }

    const [activeSchemes, chemist, priorOrders, priorCollections, unpaidInvoicesCount] = await Promise.all([
      activeSchemesPromise,
      db.chemist.findUnique({
        where: { id: chemistId },
        select: { id: true, name: true, creditLimit: true },
      }),
      db.orderItem.findMany({
        where: { order: { chemistId, status: { not: "CANCELLED" } } },
        select: { price: true, quantity: true },
      }),
      db.collection.aggregate({
        where: { chemistId },
        _sum: { amount: true },
      }),
      db.invoice.count({
        where: { paid: false, order: { chemistId, status: { not: "CANCELLED" } } },
      }),
    ]);

    if (!chemist) return notFound("Chemist not found");

    const totalOrdered = priorOrders.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const totalCollected = Number(priorCollections._sum.amount ?? 0);
    const outstanding = outstandingBalance(totalOrdered, totalCollected);
    const creditLimit = chemist.creditLimit !== null ? Number(chemist.creditLimit) : null;
    const availableHeadroom = creditLimit !== null && creditLimit > 0 ? round2(creditLimit - outstanding) : null;

    return ok({
      activeSchemes,
      chemistCredit: {
        chemistId: chemist.id,
        chemistName: chemist.name,
        creditLimit,
        outstanding,
        availableHeadroom,
        status: creditStatus({ creditLimit, outstanding }),
        unpaidInvoicesCount,
      },
    });
  } catch (err) {
    console.error("[GET /api/orders/booking-context]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to load booking context", 500);
  }
}

export const GET = withAuth(getBookingContext, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
