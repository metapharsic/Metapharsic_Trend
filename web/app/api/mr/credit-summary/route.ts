import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { outstandingBalance, creditStatus } from "@/lib/credit";
import { startOfUtcDay } from "@/lib/date";

/**
 * MR's own credit/collections picture: per-chemist outstanding against limit,
 * today's collection total, and which chemists need attention.
 */
async function getCreditSummary(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({
      where: { userId: req.user.sub },
      include: { territories: { select: { id: true } } },
    });
    if (!employee) return unauthorized("Employee record not found");

    const territoryIds = employee.territories.map((t) => t.id);
    const today = startOfUtcDay();

    const [chemists, orderItems, collections, todaysCollections, collectionsList] = await Promise.all([
      db.chemist.findMany({
        where: { territoryId: { in: territoryIds } },
        select: { id: true, name: true, creditLimit: true },
      }),
      db.orderItem.findMany({
        where: { order: { chemist: { territoryId: { in: territoryIds } }, status: { not: "CANCELLED" } } },
        select: { price: true, quantity: true, order: { select: { chemistId: true } } },
      }),
      db.collection.findMany({
        where: { chemist: { territoryId: { in: territoryIds } } },
        select: { amount: true, chemistId: true },
      }),
      db.collection.aggregate({
        where: { employeeId: employee.id, createdAt: { gte: today } },
        _sum: { amount: true },
      }),
      db.collection.findMany({
        where: { chemist: { territoryId: { in: territoryIds } } },
        include: { chemist: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const orderedByChemist = new Map<string, number>();
    for (const item of orderItems) {
      const key = item.order.chemistId;
      if (!key) continue;
      orderedByChemist.set(key, (orderedByChemist.get(key) ?? 0) + Number(item.price) * item.quantity);
    }
    const collectedByChemist = new Map<string, number>();
    for (const c of collections) {
      collectedByChemist.set(c.chemistId, (collectedByChemist.get(c.chemistId) ?? 0) + Number(c.amount));
    }

    const rows = chemists.map((c) => {
      const outstanding = outstandingBalance(orderedByChemist.get(c.id) ?? 0, collectedByChemist.get(c.id) ?? 0);
      const limit = c.creditLimit !== null ? Number(c.creditLimit) : null;
      return {
        chemistId: c.id,
        name: c.name,
        creditLimit: limit,
        outstanding,
        status: creditStatus({ creditLimit: limit, outstanding }),
      };
    });

    const attentionNeeded = rows.filter((r) => r.status === "WARNING" || r.status === "BREACHED");
    const totalOutstanding = rows.reduce((sum, r) => sum + r.outstanding, 0);

    return ok({
      chemists: rows.sort((a, b) => b.outstanding - a.outstanding),
      totalOutstanding,
      attentionNeeded,
      todaysCollection: Number(todaysCollections._sum.amount ?? 0),
      collectionsList,
    });
  } catch (err) {
    console.error("[GET /api/mr/credit-summary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch credit summary", 500);
  }
}

export const GET = withAuth(getCreditSummary, [Role.MR]);
