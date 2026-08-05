import { db } from "@/lib/db";
import { Role, OrderStatus, ClaimStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, notFound, forbidden, apiError } from "@/lib/api-response";
import { startOfUtcMonth } from "@/lib/date";
import { creditUtilizationPercent } from "@/lib/order-workflow";

/**
 * Distributor Portal home. Scope is the distributor's own account, resolved via
 * `Distributor.userId`. ADMIN may pass `?distributorId=` to inspect any account,
 * matching the drill-down pattern already used by the MR and RM dashboards.
 */
async function getDistributorDashboard(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedId = searchParams.get("distributorId");
    const isManager = req.user.role === Role.ADMIN || req.user.role === Role.MD;

    if (requestedId && !isManager) {
      return forbidden("You may only view your own distributor account");
    }

    const territorySelect = {
      include: { territory: { select: { id: true, name: true, zone: true, region: true } } },
    } as const;

    const distributor = requestedId
      ? await db.distributor.findUnique({ where: { id: requestedId }, ...territorySelect })
      : (isManager
          ? await db.distributor.findFirst(territorySelect)
          : await db.distributor.findUnique({ where: { userId: req.user.sub }, ...territorySelect }));

    if (!distributor) {
      return requestedId
        ? notFound("Distributor not found")
        : notFound("No distributor account is linked to this login");
    }

    const monthStart = startOfUtcMonth();

    const [orders, pendingOrders, monthOrderItems, invoices, pendingClaims] = await Promise.all([
      db.order.count({ where: { distributorId: distributor.id } }),
      db.order.count({
        where: {
          distributorId: distributor.id,
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.SHIPPED] },
        },
      }),
      db.orderItem.findMany({
        where: { order: { distributorId: distributor.id, createdAt: { gte: monthStart } } },
        select: { price: true, quantity: true },
      }),
      db.invoice.findMany({
        where: { order: { distributorId: distributor.id } },
        select: { amount: true, paid: true },
      }),
      db.claim.count({
        where: {
          distributorId: distributor.id,
          status: { in: [ClaimStatus.PENDING_MR, ClaimStatus.PENDING_ASM] },
        },
      }),
    ]);

    const monthlyOrderValue = monthOrderItems.reduce(
      (sum, i) => sum + Number(i.price) * i.quantity,
      0
    );
    const outstanding = invoices
      .filter((i) => !i.paid)
      .reduce((sum, i) => sum + Number(i.amount), 0);
    const creditLimit = distributor.creditLimit !== null ? Number(distributor.creditLimit) : null;

    return ok({
      distributor: {
        id: distributor.id,
        name: distributor.name,
        territory: distributor.territory
          ? { id: distributor.territory.id, name: distributor.territory.name, zone: distributor.territory.zone, region: distributor.territory.region }
          : null,
      },
      totalOrders: orders,
      pendingOrders,
      monthlyOrderValue: Math.round(monthlyOrderValue),
      invoices: {
        total: invoices.length,
        outstanding: Math.round(outstanding),
        creditLimit,
        utilizationPercent: creditUtilizationPercent(outstanding, creditLimit),
      },
      pendingClaims,
    });
  } catch (err) {
    console.error("[GET /api/distributor/dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to load distributor dashboard", 500);
  }
}

export const GET = withAuth(getDistributorDashboard, [Role.DISTRIBUTOR, Role.ADMIN, Role.MD]);
