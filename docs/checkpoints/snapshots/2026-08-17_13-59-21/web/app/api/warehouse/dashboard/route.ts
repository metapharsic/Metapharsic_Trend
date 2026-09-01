import { db } from "@/lib/db";
import { Role, OrderStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { startOfUtcDay, addUtcDays } from "@/lib/date";

// No per-product minimum-stock field exists in the schema — this threshold is a
// heuristic warehouse floor, not a stored business rule. Flag if it's wrong for
// a given product; a real fix means adding Product.minStockQty.
const LOW_STOCK_THRESHOLD = 300;

async function getWarehouseDashboard(_req: AuthedRequest) {
  try {
    const todayStart = startOfUtcDay();
    const todayEnd = addUtcDays(todayStart, 1);

    const [pendingOrders, confirmedOrders, shippedTodayCount, samplesAgg, lowStockProducts] = await Promise.all([
      db.order.findMany({
        where: { status: OrderStatus.PENDING },
        include: { chemist: { select: { name: true, address: true } }, distributor: { select: { name: true, address: true } }, items: true },
        orderBy: { createdAt: "asc" },
      }),
      db.order.findMany({
        where: { status: OrderStatus.CONFIRMED },
        include: { chemist: { select: { name: true, address: true } }, distributor: { select: { name: true, address: true } }, items: true },
        orderBy: { createdAt: "asc" },
      }),
      db.order.count({
        where: { status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED] }, updatedAt: { gte: todayStart, lt: todayEnd } },
      }),
      db.sample.aggregate({ _sum: { quantity: true } }),
      db.product.findMany({ where: { stockQty: { lt: LOW_STOCK_THRESHOLD } }, orderBy: { stockQty: "asc" } }),
    ]);

    const toDispatch = (o: (typeof pendingOrders)[number], status: "PACKING" | "READY") => ({
      id: o.id,
      orderId: o.id.slice(0, 8).toUpperCase(),
      distributor: o.chemist?.name ?? o.distributor.name,
      location: o.chemist?.address ?? o.distributor.address,
      itemsCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      status,
      createdAt: o.createdAt,
    });

    const dispatches = [
      ...pendingOrders.map((o) => toDispatch(o, "PACKING")),
      ...confirmedOrders.map((o) => toDispatch(o, "READY")),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return ok({
      kpis: {
        pendingDispatches: pendingOrders.length + confirmedOrders.length,
        shippedToday: shippedTodayCount,
        lowStockAlerts: lowStockProducts.length,
        samplesDistributed: samplesAgg._sum.quantity ?? 0,
      },
      dispatches,
      alerts: lowStockProducts.map((p) => ({
        id: p.id,
        productName: p.name,
        sku: p.sku,
        currentStock: p.stockQty,
        minThreshold: LOW_STOCK_THRESHOLD,
      })),
    });
  } catch (err) {
    console.error("[GET /api/warehouse/dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch warehouse dashboard", 500);
  }
}

export const GET = withAuth(getWarehouseDashboard, [Role.WAREHOUSE, Role.ADMIN]);
