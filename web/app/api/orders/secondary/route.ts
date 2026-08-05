import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, unauthorized, apiError } from "@/lib/api-response";
import { CreateOrderSchema, PaginationSchema } from "@/lib/validators";
import { bestSchemeFor, round2 } from "@/lib/scheme";
import { outstandingBalance, canPlaceOrder } from "@/lib/credit";
import { computeInvoiceTotals } from "@/lib/gst";


async function getOrders(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN || req.user.role === Role.MD;

    let chemistFilter: Record<string, unknown> | undefined;
    if (!isManager) {
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
        include: { territories: true },
      });
      if (!employee) return unauthorized("Employee record not found");
      const territoryIds = employee.territories.map((t) => t.id);
      chemistFilter = { territoryId: { in: territoryIds } };
    }

    const where = {
      ...(status ? { status: status as any } : {}),
      ...(chemistFilter ? { chemist: chemistFilter } : {}),
    };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          chemist: { select: { id: true, name: true, creditLimit: true } },
          distributor: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          invoice: { select: { invoiceNo: true, amount: true, paid: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    // Attach each order's chemist's current outstanding balance so the list
    // doubles as a running "what's left to collect" view, not just a log.
    const chemistIds = [...new Set(orders.map((o) => o.chemistId).filter(Boolean))] as string[];
    const [chemistOrderItems, chemistCollections] = await Promise.all([
      db.orderItem.findMany({
        where: { order: { chemistId: { in: chemistIds }, status: { not: "CANCELLED" } } },
        select: { price: true, quantity: true, order: { select: { chemistId: true } } },
      }),
      db.collection.findMany({
        where: { chemistId: { in: chemistIds } },
        select: { amount: true, chemistId: true },
      }),
    ]);
    const orderedByChemist = new Map<string, number>();
    for (const item of chemistOrderItems) {
      const key = item.order.chemistId;
      if (!key) continue;
      orderedByChemist.set(key, (orderedByChemist.get(key) ?? 0) + Number(item.price) * item.quantity);
    }
    const collectedByChemist = new Map<string, number>();
    for (const c of chemistCollections) {
      collectedByChemist.set(c.chemistId, (collectedByChemist.get(c.chemistId) ?? 0) + Number(c.amount));
    }

    const ordersWithBalance = orders.map((o) => ({
      ...o,
      chemistOutstanding: o.chemistId
        ? outstandingBalance(orderedByChemist.get(o.chemistId) ?? 0, collectedByChemist.get(o.chemistId) ?? 0)
        : null,
    }));

    return ok({ orders: ordersWithBalance, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[GET /api/orders/secondary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch orders", 500);
  }
}

async function createOrder(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { chemistId, distributorId, items, lrNo, lrDate, cases, dueDate, transport, vehicleNo } = parsed.data;

    const [chemist, distributor] = await Promise.all([
      db.chemist.findUnique({ where: { id: chemistId } }),
      db.distributor.findUnique({ where: { id: distributorId } }),
    ]);
    if (!chemist) return notFound("Chemist not found");
    if (!distributor) return notFound("Distributor not found");

    const productIds = items.map((i) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== items.length) {
      return badRequest("One or more products could not be found");
    }
    const priceMap = new Map(products.map((p) => [p.id, Number(p.ptr ?? p.price)]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Auto-apply the best qualifying discount scheme per line (Phase 2 Week 8 spec).
    const now = new Date();
    const schemes = await db.discountScheme.findMany({
      where: { isActive: true, productId: { in: productIds }, validFrom: { lte: now }, validTo: { gte: now } },
    });

    const appliedSchemes: { productId: string; scheme: string; discountPct: number }[] = [];

    const lineItems = items.map((item) => {
      const listPrice = priceMap.get(item.productId)!;
      const product = productMap.get(item.productId)!;
      const candidates = schemes
        .filter((s) => s.productId === item.productId)
        .map((s) => ({
          id: s.id,
          name: s.name,
          minQuantity: s.minQuantity,
          discountPct: s.discountPct,
          isActive: s.isActive,
          validFrom: s.validFrom,
          validTo: s.validTo,
        }));

      const scheme = bestSchemeFor(candidates, item.quantity, now);
      // A manual line discount only applies when no automatic scheme fired —
      // schemes and manual discounts are alternatives, never stacked.
      const discountPct = scheme ? scheme.discountPct : item.discountPct ?? 0;
      const price = round2(listPrice * (1 - discountPct / 100));
      const gstPct = item.gstPct ?? (product.gstPct !== null ? Number(product.gstPct) : 0);

      if (scheme) {
        appliedSchemes.push({
          productId: item.productId,
          scheme: scheme.name,
          discountPct: scheme.discountPct,
        });
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        price,
        hsnCode: product.hsnCode,
        // Falls back to the product's current warehouse batch so a booking
        // MR doesn't have to know/type it — update it once in Inventory and
        // every new sale/invoice picks it up automatically.
        batchNo: item.batchNo ?? product.currentBatchNo ?? null,
        mfgDate: item.mfgDate ?? product.currentMfgDate ?? null,
        expDate: item.expDate ?? product.currentExpDate ?? null,
        packSize: product.packSize,
        freeQty: item.freeQty ?? 0,
        mrp: product.mrp,
        discountPct,
        gstPct,
        listPrice,
      };
    });

    // Credit gate: block the order if it would push this chemist's outstanding
    // balance past their configured limit. A null limit is unrestricted.
    const newOrderValue = lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0);
    if (chemist.creditLimit !== null) {
      const [priorOrders, priorCollections] = await Promise.all([
        db.orderItem.findMany({
          where: { order: { chemistId, status: { not: "CANCELLED" } } },
          select: { price: true, quantity: true },
        }),
        db.collection.aggregate({ where: { chemistId }, _sum: { amount: true } }),
      ]);
      const totalOrdered = priorOrders.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
      const totalCollected = Number(priorCollections._sum.amount ?? 0);
      const outstanding = outstandingBalance(totalOrdered, totalCollected);

      const decision = canPlaceOrder(
        { creditLimit: Number(chemist.creditLimit), outstanding },
        newOrderValue
      );
      if (!decision.allowed) return badRequest(decision.reason);
    }

    // Attribute the order to the booking employee so per-rep sales can be reported.
    const bookingEmployee = await db.employee.findUnique({
      where: { userId: req.user.sub },
      select: { id: true },
    });

    // GST math for the invoice — driven off the pre-discount list price, so
    // discount% and taxable value reconcile the same way a printed invoice does.
    const gstTotals = computeInvoiceTotals(
      lineItems.map((li) => ({ quantity: li.quantity, price: li.listPrice, discountPct: li.discountPct, gstPct: li.gstPct }))
    );
    const orderItemsData = lineItems.map(({ listPrice, ...rest }) => rest);

    // Every booked order is a sale on credit — generate its invoice in the same
    // transaction so an order can never exist without one to collect against.
    const { order, invoice } = await db.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          chemistId,
          distributorId,
          employeeId: bookingEmployee?.id ?? null,
          items: { create: orderItemsData },
        },
        include: { items: true },
      });

      const createdInvoice = await tx.invoice.create({
        data: {
          orderId: createdOrder.id,
          invoiceNo: `INV-${createdOrder.createdAt.getTime()}-${createdOrder.id.slice(0, 6).toUpperCase()}`,
          amount: newOrderValue,
          paid: false,
          // Snapshot the billing party as it stands right now — later edits to
          // the chemist's billing details must not retroactively alter this invoice.
          partyName: chemist.billingName || chemist.name,
          partyGstNo: chemist.gstNo,
          partyAddress: chemist.address,
          partyDlNo: chemist.licenseNo,
          partyPhone: chemist.mobile,
          lrNo,
          lrDate,
          cases,
          dueDate,
          transport,
          vehicleNo,
          totalItems: gstTotals.totalItems,
          totalQty: gstTotals.totalQty,
          totalDiscount: gstTotals.totalDiscount,
          totalGst: gstTotals.totalGst,
          roundOff: gstTotals.roundOff,
          grandTotal: gstTotals.grandTotal,
        },
      });

      return { order: createdOrder, invoice: createdInvoice };
    });

    return created({ order, invoice, appliedSchemes });
  } catch (err) {
    console.error("[POST /api/orders/secondary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create order", 500);
  }
}

export const GET = withAuth(getOrders, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
// MR is the first point of contact for a chemist — orders are booked from the
// field, not injected by managers. ASM/ADMIN can view and advance fulfilment
// status but never originate a sale themselves.
export const POST = withAuth(createOrder, [Role.MR]);
