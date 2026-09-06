import { db } from "@/lib/db";
import { Prisma, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, unauthorized } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { CacheService } from "@/services/cache.service";
import {
  COST_BASIS_SELECT,
  costBasis,
  profitFor,
  purchaseProfitFor,
  round2,
  type CostBasisSource,
} from "@/lib/pricing";

// Shape of the item data the profit math needs — kept identical between the
// paged query and the totals query so both compute profit the same way.
// The product fields come from COST_BASIS_SELECT so the cost basis here is the
// same one every other module uses.
const PROFIT_ITEM_SELECT = {
  id: true,
  price: true,
  quantity: true,
  freeQty: true,
  discountPct: true,
  gstPct: true,
  product: { select: { ...COST_BASIS_SELECT, name: true, sku: true } },
} as const;

type ProfitItem = {
  id?: string;
  price: Prisma.Decimal;
  quantity: number;
  freeQty: number;
  discountPct?: Prisma.Decimal | null;
  gstPct?: Prisma.Decimal | null;
  product: {
    id: string;
    name?: string;
    sku?: string;
    purchaseRate: Prisma.Decimal | null;
    pts: Prisma.Decimal | null;
    ptr: Prisma.Decimal | null;
    price: Prisma.Decimal;
  };
};

export interface LineItemProfitBreakdown {
  id?: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  freeQty: number;
  billedPrice: number;
  costBasis: number;
  costBasisSource: CostBasisSource;
  lineRevenue: number;
  lineCost: number;
  lineProfit: number;
  lineProfitPct: number | null;
}

/**
 * Per-invoice and line-item margin, computed at read time (nothing is persisted).
 *
 * All cost/profit derivation is delegated to lib/pricing — this route does not
 * own a cost basis and must never invent one.
 */
function computeProfit(items: ProfitItem[]) {
  const totals = profitFor(items);
  const purchaseTotals = purchaseProfitFor(items);

  const lineItems: LineItemProfitBreakdown[] = items.map((item) => {
    const line = profitFor([item]);
    const basis = costBasis(item.product);
    return {
      id: item.id,
      productId: item.product.id,
      productName: item.product.name ?? "Pharmaceutical Product",
      sku: item.product.sku,
      quantity: item.quantity,
      freeQty: item.freeQty ?? 0,
      billedPrice: Number(item.price),
      costBasis: basis.value,
      costBasisSource: basis.source,
      lineRevenue: line.revenue,
      lineCost: line.cost,
      lineProfit: line.profitAmount,
      lineProfitPct: line.profitPct,
    };
  });

  return {
    revenue: totals.revenue,
    cost: totals.cost,
    profitAmount: totals.profitAmount,
    profitPct: totals.profitPct,
    costBasisExact: totals.exact,
    costBasisSources: totals.sources,
    lineItems,
    purchaseCost: purchaseTotals.purchaseCost,
    purchaseProfitAmount: purchaseTotals.profitAmount,
    purchaseProfitPct: purchaseTotals.profitPct,
    purchaseCostComplete: purchaseTotals.complete,
    purchaseUnpricedUnits: purchaseTotals.unpricedUnits,
  };
}

async function getInvoices(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    const q = searchParams.get("q")?.trim() || undefined;
    const customer = searchParams.get("customer")?.trim() || undefined;
    const paidParam = searchParams.get("paid");
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const isManager =
      req.user.role === Role.ASM ||
      req.user.role === Role.ADMIN ||
      req.user.role === Role.MD ||
      req.user.role === Role.NSM ||
      req.user.role === Role.ZSM ||
      req.user.role === Role.RM ||
      req.user.role === Role.FINANCE ||
      req.user.role === Role.WAREHOUSE ||
      req.user.role === Role.MARKETING ||
      req.user.role === Role.HR;

    const filters: Prisma.InvoiceWhereInput[] = [];

    if (!isManager) {
      // Find MR employee record — an MR only ever sees invoices for orders
      // they booked themselves (same scope as /api/orders/secondary).
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
      });
      if (!employee) return unauthorized("Employee record not found");
      filters.push({ order: { employeeId: employee.id } });
    }

    const like = (value: string) => ({ contains: value, mode: "insensitive" as const });

    if (q) {
      filters.push({
        OR: [
          { invoiceNo: like(q) },
          { partyName: like(q) },
          { order: { chemist: { name: like(q) } } },
          { order: { distributor: { name: like(q) } } },
        ],
      });
    }

    if (customer) {
      filters.push({
        OR: [
          { partyName: like(customer) },
          { order: { chemist: { name: like(customer) } } },
          { order: { distributor: { name: like(customer) } } },
        ],
      });
    }

    if (paidParam === "true" || paidParam === "false") {
      filters.push({ paid: paidParam === "true" });
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) createdAt.lte = d;
    }
    if (createdAt.gte || createdAt.lte) filters.push({ createdAt });

    const where: Prisma.InvoiceWhereInput = filters.length ? { AND: filters } : {};

    // Run paged query and count concurrently
    const [rows, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              chemist: { select: { id: true, name: true } },
              distributor: { select: { id: true, name: true } },
              items: { select: PROFIT_ITEM_SELECT },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.invoice.count({ where }),
    ]);

    const invoices = rows.map((inv) => {
      const profit = computeProfit(inv.order?.items ?? []);
      return {
        ...inv,
        revenue: profit.revenue,
        cost: profit.cost,
        profitAmount: profit.profitAmount,
        profitPct: profit.profitPct,
        costBasisExact: profit.costBasisExact,
        costBasisSources: profit.costBasisSources,
        profitItems: profit.lineItems,
        purchaseCost: profit.purchaseCost,
        purchaseProfitAmount: profit.purchaseProfitAmount,
        purchaseProfitPct: profit.purchaseProfitPct,
        purchaseCostComplete: profit.purchaseCostComplete,
        purchaseUnpricedUnits: profit.purchaseUnpricedUnits,
      };
    });

    // High-performance caching for totals across all matching invoices
    const cacheKey = `invoices_totals_${req.user.role}_${req.user.sub}_${q || ""}_${customer || ""}_${paidParam || ""}_${from || ""}_${to || ""}`;
    const totals = await CacheService.getOrCompute(
      cacheKey,
      async () => {
        const allForTotals = await db.invoice.findMany({
          where,
          select: { order: { select: { items: { select: PROFIT_ITEM_SELECT } } } },
        });

        let totalProfitAmount = 0;
        let totalRevenue = 0;
        let totalCost = 0;
        let totalPurchaseCost = 0;
        let totalPurchaseProfitAmount = 0;
        let purchaseCostComplete = true;
        let totalUnpricedUnits = 0;
        for (const inv of allForTotals) {
          const p = computeProfit(inv.order?.items ?? []);
          totalProfitAmount += p.profitAmount;
          totalRevenue += p.revenue;
          totalCost += p.cost;
          totalPurchaseCost += p.purchaseCost;
          totalPurchaseProfitAmount += p.purchaseProfitAmount;
          if (!p.purchaseCostComplete) purchaseCostComplete = false;
          totalUnpricedUnits += p.purchaseUnpricedUnits;
        }

        return {
          cost: round2(totalCost),
          profitAmount: round2(totalProfitAmount),
          revenue: round2(totalRevenue),
          profitPct: totalRevenue === 0 ? null : round2((totalProfitAmount / totalRevenue) * 100),
          purchaseCost: round2(totalPurchaseCost),
          purchaseProfitAmount: round2(totalPurchaseProfitAmount),
          purchaseProfitPct:
            totalRevenue === 0 ? null : round2((totalPurchaseProfitAmount / totalRevenue) * 100),
          purchaseCostComplete,
          purchaseUnpricedUnits: totalUnpricedUnits,
        };
      },
      20 // 20s TTL
    );

    return ok({
      invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      totals,
    });
  } catch (err) {
    console.error("[GET /api/invoices]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch invoices", 500);
  }
}

export const GET = withAuth(getInvoices);
