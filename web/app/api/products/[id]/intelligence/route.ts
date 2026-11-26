import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, apiError } from "@/lib/api-response";
import { costBasis, profitFor, round2 } from "@/lib/pricing";
import { computeShelfLife, getMedicineReference } from "@/lib/medicine-reference";

async function getProductIntelligence(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const product = await db.product.findUnique({
      where: { id },
    });
    if (!product) return notFound("Product not found");

    const clinicalProfile = getMedicineReference(product);
    const shelfLife = computeShelfLife(product.currentExpDate);
    const isAdmin = req.user.role === Role.ADMIN;

    // Non-admins get full clinical/detailing intelligence + safe catalog details, zero commercial profit/cost data
    if (!isAdmin) {
      return ok({
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          composition: product.composition,
          strength: product.strength,
          packSize: product.packSize,
          therapySegment: product.therapySegment,
          hsnCode: product.hsnCode,
          gstPct: product.gstPct != null ? Number(product.gstPct) : null,
          mrp: product.mrp != null ? Number(product.mrp) : null,
          ptr: product.ptr != null ? Number(product.ptr) : null,
        },
        clinicalProfile,
        shelfLife,
        commercialRestricted: true,
      });
    }

    // ADMIN: Full 360° per-medicine sales, chemists, MR activity, samples, scheme breakdown & movement ledger
    const [invoicedOrderItems, sampleHoldings, sampleLogs, movements] = await Promise.all([
      db.orderItem.findMany({
        where: { productId: id, order: { invoice: { isNot: null } } },
        include: {
          order: {
            select: {
              id: true,
              createdAt: true,
              chemist: { select: { id: true, name: true, subArea: true, beatName: true, territory: { select: { name: true } } } },
              employee: { select: { id: true, firstName: true, lastName: true } },
              invoice: { select: { id: true, invoiceNo: true, createdAt: true, partyName: true, grandTotal: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.sampleInventory.findMany({
        where: { productId: id },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { quantity: "desc" },
      }),
      db.sampleAllocationLog.findMany({
        where: { productId: id },
        orderBy: { createdAt: "desc" },
        select: { employeeId: true, createdAt: true, quantity: true },
      }),
      db.inventoryMovement.findMany({
        where: { productId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { employee: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const cost = costBasis(product);
    const earliestMove = movements.length > 0 ? movements[movements.length - 1] : null;
    const earliestStockQty = earliestMove ? earliestMove.quantityAfter - earliestMove.delta : product.stockQty;

    // 1. Monthly Trend (chronological)
    const monthlyMap = new Map<
      string,
      { month: string; invoicesSet: Set<string>; items: typeof invoicedOrderItems }
    >();

    // 2. Top Buying Chemists
    const chemistMap = new Map<
      string,
      {
        chemistId: string;
        chemistName: string;
        area: string;
        invoicesSet: Set<string>;
        billedQty: number;
        freeQty: number;
        lastOrderDate: Date;
        items: typeof invoicedOrderItems;
      }
    >();

    // 3. MR Sales Performance + Samples Held
    const mrMap = new Map<
      string,
      {
        employeeId: string;
        mrName: string;
        invoicesSet: Set<string>;
        billedQty: number;
        freeQty: number;
        sampleQtyHeld: number;
        lastSampleGivenAt: Date | null;
        items: typeof invoicedOrderItems;
      }
    >();

    const lastSampleDateByEmp = new Map<string, Date>();
    for (const log of sampleLogs) {
      if (!lastSampleDateByEmp.has(log.employeeId)) {
        lastSampleDateByEmp.set(log.employeeId, log.createdAt);
      }
    }
    for (const sh of sampleHoldings) {
      const name = `${sh.employee.firstName} ${sh.employee.lastName}`.trim();
      mrMap.set(sh.employeeId, {
        employeeId: sh.employeeId,
        mrName: name,
        invoicesSet: new Set<string>(),
        billedQty: 0,
        freeQty: 0,
        sampleQtyHeld: sh.quantity,
        lastSampleGivenAt: lastSampleDateByEmp.get(sh.employeeId) ?? sh.updatedAt,
        items: [],
      });
    }

    // 4. Scheme Ratio Mix
    const schemeMap = new Map<
      string,
      { ratioLabel: string; linesCount: number; billedQty: number; freeQty: number; items: typeof invoicedOrderItems }
    >();

    for (const it of invoicedOrderItems) {
      const inv = it.order.invoice;
      const invDate = inv?.createdAt ?? it.order.createdAt;
      const monthKey = invDate.toISOString().slice(0, 7);
      const invId = inv?.id ?? it.orderId;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { month: monthKey, invoicesSet: new Set(), items: [] });
      }
      const mEntry = monthlyMap.get(monthKey)!;
      mEntry.invoicesSet.add(invId);
      mEntry.items.push(it);

      const chemistKey = it.order.chemist?.id ?? (inv?.partyName || "direct");
      const chemistName = it.order.chemist?.name ?? inv?.partyName ?? "Direct Party";
      const area =
        [it.order.chemist?.subArea, it.order.chemist?.territory?.name].filter(Boolean).join(" · ") ||
        it.order.chemist?.beatName ||
        "—";
      if (!chemistMap.has(chemistKey)) {
        chemistMap.set(chemistKey, {
          chemistId: chemistKey,
          chemistName,
          area,
          invoicesSet: new Set(),
          billedQty: 0,
          freeQty: 0,
          lastOrderDate: invDate,
          items: [],
        });
      }
      const chEntry = chemistMap.get(chemistKey)!;
      chEntry.invoicesSet.add(invId);
      chEntry.billedQty += it.quantity;
      chEntry.freeQty += it.freeQty || 0;
      if (invDate > chEntry.lastOrderDate) chEntry.lastOrderDate = invDate;
      chEntry.items.push(it);

      const empId = it.order.employee?.id ?? "unassigned";
      const empName = it.order.employee
        ? `${it.order.employee.firstName} ${it.order.employee.lastName}`.trim()
        : "Unassigned / Direct";
      if (!mrMap.has(empId)) {
        mrMap.set(empId, {
          employeeId: empId,
          mrName: empName,
          invoicesSet: new Set(),
          billedQty: 0,
          freeQty: 0,
          sampleQtyHeld: 0,
          lastSampleGivenAt: null,
          items: [],
        });
      }
      const mrEntry = mrMap.get(empId)!;
      mrEntry.invoicesSet.add(invId);
      mrEntry.billedQty += it.quantity;
      mrEntry.freeQty += it.freeQty || 0;
      mrEntry.items.push(it);

      const free = it.freeQty || 0;
      const schemeKey = free === 0 ? "No Free Scheme (0 free)" : `${it.quantity}+${free}`;
      if (!schemeMap.has(schemeKey)) {
        schemeMap.set(schemeKey, { ratioLabel: schemeKey, linesCount: 0, billedQty: 0, freeQty: 0, items: [] });
      }
      const scEntry = schemeMap.get(schemeKey)!;
      scEntry.linesCount += 1;
      scEntry.billedQty += it.quantity;
      scEntry.freeQty += free;
      scEntry.items.push(it);
    }

    const toProfitLines = (items: typeof invoicedOrderItems) =>
      items.map((it) => ({
        quantity: it.quantity,
        freeQty: it.freeQty,
        price: it.price,
        product,
      }));

    const monthlyTrend = [...monthlyMap.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => {
        const calc = profitFor(toProfitLines(m.items));
        const billedQty = m.items.reduce((s, x) => s + x.quantity, 0);
        const freeQty = m.items.reduce((s, x) => s + (x.freeQty || 0), 0);
        return {
          month: m.month,
          invoicesCount: m.invoicesSet.size,
          billedQty,
          freeQty,
          revenue: calc.revenue,
          cost: calc.cost,
          profit: calc.profitAmount,
          marginPct: calc.profitPct,
        };
      });

    const topChemists = [...chemistMap.values()]
      .map((c) => {
        const calc = profitFor(toProfitLines(c.items));
        return {
          chemistId: c.chemistId,
          chemistName: c.chemistName,
          area: c.area,
          invoicesCount: c.invoicesSet.size,
          billedQty: c.billedQty,
          freeQty: c.freeQty,
          totalUnits: c.billedQty + c.freeQty,
          revenue: calc.revenue,
          profit: calc.profitAmount,
          marginPct: calc.profitPct,
          lastOrderDate: c.lastOrderDate.toISOString(),
        };
      })
      .sort((a, b) => b.profit - a.profit);

    const mrBreakdown = [...mrMap.values()]
      .map((r) => {
        const calc = profitFor(toProfitLines(r.items));
        return {
          employeeId: r.employeeId,
          mrName: r.mrName,
          invoicesCount: r.invoicesSet.size,
          billedQty: r.billedQty,
          freeQty: r.freeQty,
          sampleQtyHeld: r.sampleQtyHeld,
          lastSampleGivenAt: r.lastSampleGivenAt ? r.lastSampleGivenAt.toISOString() : null,
          revenue: calc.revenue,
          profit: calc.profitAmount,
          marginPct: calc.profitPct,
        };
      })
      .sort((a, b) => b.billedQty + b.sampleQtyHeld - (a.billedQty + a.sampleQtyHeld));

    const schemeMix = [...schemeMap.values()]
      .map((sc) => {
        const calc = profitFor(toProfitLines(sc.items));
        return {
          ratioLabel: sc.ratioLabel,
          linesCount: sc.linesCount,
          billedQty: sc.billedQty,
          freeQty: sc.freeQty,
          revenue: calc.revenue,
          cost: calc.cost,
          profit: calc.profitAmount,
          marginPct: calc.profitPct,
        };
      })
      .sort((a, b) => b.linesCount - a.linesCount);

    const recentInvoices = invoicedOrderItems.slice(0, 15).map((it) => {
      const calc = profitFor([{ quantity: it.quantity, freeQty: it.freeQty, price: it.price, product }]);
      const inv = it.order.invoice;
      return {
        invoiceNo: inv?.invoiceNo ?? `ORD-${it.orderId.slice(0, 8).toUpperCase()}`,
        date: (inv?.createdAt ?? it.order.createdAt).toISOString(),
        partyName: it.order.chemist?.name ?? inv?.partyName ?? "—",
        area: it.order.chemist?.subArea ?? it.order.chemist?.territory?.name ?? "",
        mrName: it.order.employee ? `${it.order.employee.firstName} ${it.order.employee.lastName}`.trim() : "—",
        billedQty: it.quantity,
        freeQty: it.freeQty || 0,
        unitRate: round2(Number(it.price)),
        lineRevenue: calc.revenue,
        lineCost: calc.cost,
        lineProfit: calc.profitAmount,
        lineMarginPct: calc.profitPct,
      };
    });

    return ok({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockQty: product.stockQty,
        stockBoxes: round2(product.stockQty / 10),
        earliestStockQty,
        costPerUnit: cost.value,
        costExact: cost.exact,
      },
      clinicalProfile,
      shelfLife,
      monthlyTrend,
      topChemists,
      mrBreakdown,
      schemeMix,
      recentInvoices,
      movements,
    });
  } catch (err) {
    console.error("[GET /api/products/[id]/intelligence]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to load medicine intelligence", 500);
  }
}

export const GET = withAuth(getProductIntelligence, [Role.MR, Role.ASM, Role.ADMIN, Role.MD, Role.WAREHOUSE]);
