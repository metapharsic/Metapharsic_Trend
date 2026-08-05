import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { outstandingBalance, creditStatus } from "@/lib/credit";
import { startOfUtcDay } from "@/lib/date";

/**
 * Company-wide credit exposure — every chemist against every MR's collections.
 * Mirrors /api/mr/credit-summary's math exactly so the numbers a rep sees for
 * their own book match what shows up here, just unfiltered by territory.
 */
async function getCreditOverview(req: AuthedRequest) {
  try {
    const today = startOfUtcDay();

    const [chemists, orderItems, collections, todaysCollections, collectionsList] = await Promise.all([
      db.chemist.findMany({
        select: {
          id: true,
          name: true,
          creditLimit: true,
          territory: { select: { id: true, name: true, employee: { select: { firstName: true, lastName: true } } } },
        },
      }),
      db.orderItem.findMany({
        where: { order: { status: { not: "CANCELLED" } } },
        select: { price: true, quantity: true, order: { select: { chemistId: true } } },
      }),
      db.collection.findMany({
        select: { amount: true, chemistId: true, createdAt: true },
      }),
      db.collection.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { amount: true },
      }),
      db.collection.findMany({
        include: {
          chemist: { select: { name: true } },
          employee: { select: { firstName: true, lastName: true } },
        },
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
        territory: c.territory.name,
        mr: c.territory.employee ? `${c.territory.employee.firstName} ${c.territory.employee.lastName}` : "Unassigned",
        creditLimit: limit,
        outstanding,
        status: creditStatus({ creditLimit: limit, outstanding }),
      };
    });

    const breached = rows.filter((r) => r.status === "BREACHED");
    const warning = rows.filter((r) => r.status === "WARNING");
    const totalOutstanding = rows.reduce((sum, r) => sum + r.outstanding, 0);

    return ok({
      chemists: rows.sort((a, b) => b.outstanding - a.outstanding),
      totalOutstanding,
      breachedCount: breached.length,
      warningCount: warning.length,
      todaysCollection: Number(todaysCollections._sum.amount ?? 0),
      collectionsList,
    });
  } catch (err) {
    console.error("[GET /api/manager/credit]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch credit overview", 500);
  }
}

export const GET = withAuth(getCreditOverview, [Role.ASM, Role.ADMIN, Role.FINANCE]);
