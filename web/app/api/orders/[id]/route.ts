import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, unauthorized, apiError } from "@/lib/api-response";
import { UpdateOrderStatusSchema, UpdateOrderItemsSchema } from "@/lib/validators";
import { bestSchemeFor, round2 } from "@/lib/scheme";
import { computeInvoiceTotals } from "@/lib/gst";

// Orders are only editable/deletable before dispatch — once SHIPPED or
// DELIVERED the invoice is a real, physically-fulfilled transaction and
// must stay put for audit trail; CANCELLED orders are already dead.
const LOCKED_STATUSES = ["SHIPPED", "DELIVERED", "CANCELLED"];


/**
 * Single order + invoice detail — this is what backs the printable invoice
 * page. Open to any role that can already see this order in a list (MR for
 * their own territory, ASM/ADMIN unrestricted, DISTRIBUTOR for their own).
 */
async function getOrder(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const order = await db.order.findUnique({
      where: { id },
      include: {
        chemist: { select: { name: true, address: true, mobile: true, gstNo: true, territoryId: true } },
        doctor: { select: { fullName: true, clinicAddress: true, mobile: true, territoryId: true } },
        distributor: { select: { name: true, address: true, gstNo: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        invoice: true,
      },
    });
    if (!order) return notFound("Order not found");

    if (req.user.role === Role.MR) {
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
        include: { territories: { select: { id: true } } },
      });
      if (!employee) return unauthorized("Employee record not found");

      // MRs can always see orders they personally booked — territory
      // reassignment shouldn't retroactively lock someone out of their own
      // historical sales. Otherwise, fall back to a territory-membership check.
      const bookedByThisMr = order.employeeId === employee.id;
      const territoryIds = employee.territories.map((t) => t.id);
      const entityTerritoryId = order.chemist?.territoryId ?? order.doctor?.territoryId ?? null;
      const inTerritory = entityTerritoryId !== null && territoryIds.includes(entityTerritoryId);

      if (!bookedByThisMr && !inTerritory) {
        return forbidden("This order is outside your territory");
      }
    } else if (req.user.role === Role.DISTRIBUTOR) {
      const distributor = await db.distributor.findUnique({ where: { userId: req.user.sub } });
      if (!distributor || order.distributorId !== distributor.id) {
        return forbidden("This order does not belong to your account");
      }
    }

    return ok({ order });
  } catch (err) {
    console.error("[GET /api/orders/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch order", 500);
  }
}

async function updateOrder(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();

    // Two distinct edits share this endpoint: fulfilment status advance
    // (ASM/ADMIN/MD/WAREHOUSE), and line-item edits on a still-open order
    // (MR, ASM, ADMIN — same roles allowed to book it in the first place).
    if (body && typeof body === "object" && Array.isArray((body as any).items)) {
      return updateOrderItems(req, id, body);
    }

    const parsed = UpdateOrderStatusSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.order.findUnique({ where: { id } });
    if (!existing) return notFound("Order not found");

    const order = await db.order.update({
      where: { id },
      data: { status: parsed.data.status },
      include: { items: true, chemist: true, distributor: true },
    });

    return ok({ order });
  } catch (err) {
    console.error("[PUT /api/orders/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update order", 500);
  }
}

async function updateOrderItems(req: AuthedRequest, id: string, body: unknown) {
  const parsed = UpdateOrderItemsSchema.safeParse(body);
  if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

  const existing = await db.order.findUnique({ where: { id }, include: { invoice: true, items: true } });
  if (!existing) return notFound("Order not found");
  if (LOCKED_STATUSES.includes(existing.status)) {
    return badRequest(`Order is ${existing.status.toLowerCase()} and can no longer be edited.`);
  }

  if (req.user.role === Role.MR) {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee || existing.employeeId !== employee.id) {
      return forbidden("You may only edit orders you booked yourself");
    }
  }

  const productIds = parsed.data.items.map((i) => i.productId);
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    return badRequest("One or more products could not be found");
  }
  const priceMap = new Map(products.map((p) => [p.id, Number(p.ptr ?? p.price)]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const now = new Date();
  const schemes = await db.discountScheme.findMany({
    where: { isActive: true, productId: { in: productIds }, validFrom: { lte: now }, validTo: { gte: now } },
  });

  const lineItems = parsed.data.items.map((item) => {
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
    const discountPct = scheme ? scheme.discountPct : item.discountPct ?? 0;
    const price = round2(listPrice * (1 - discountPct / 100));
    const gstPct = item.gstPct ?? (product.gstPct !== null ? Number(product.gstPct) : 0);

    return {
      productId: item.productId,
      quantity: item.quantity,
      price,
      hsnCode: product.hsnCode,
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

  const newOrderValue = lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0);
  const gstTotals = computeInvoiceTotals(
    lineItems.map((li) => ({ quantity: li.quantity, price: li.listPrice, discountPct: li.discountPct, gstPct: li.gstPct }))
  );
  const orderItemsData = lineItems.map(({ listPrice, ...rest }) => rest);

  const updated = await db.$transaction(async (tx) => {
    // Restore stock for the old line quantities before applying the new
    // ones — otherwise editing an order silently double-deducts stock.
    for (const oldItem of existing.items) {
      await tx.product.update({
        where: { id: oldItem.productId },
        data: { stockQty: { increment: oldItem.quantity } },
      });
    }
    for (const li of lineItems) {
      const updatedProduct = await tx.product.update({
        where: { id: li.productId },
        data: { stockQty: { decrement: li.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: li.productId,
          type: "ORDER_DEDUCTION",
          delta: -li.quantity,
          quantityAfter: updatedProduct.stockQty,
          note: `Order ${id.slice(0, 8).toUpperCase()} edited`,
        },
      });
    }

    await tx.orderItem.deleteMany({ where: { orderId: id } });
    const order = await tx.order.update({
      where: { id },
      data: { items: { create: orderItemsData } },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } }, chemist: true, distributor: true },
    });
    if (existing.invoice) {
      await tx.invoice.update({
        where: { orderId: id },
        data: {
          amount: newOrderValue,
          totalItems: gstTotals.totalItems,
          totalQty: gstTotals.totalQty,
          totalDiscount: gstTotals.totalDiscount,
          totalGst: gstTotals.totalGst,
          roundOff: gstTotals.roundOff,
          grandTotal: gstTotals.grandTotal,
        },
      });
    }
    return order;
  });

  return ok({ order: updated });
}

async function deleteOrder(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const existing = await db.order.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return notFound("Order not found");
    if (LOCKED_STATUSES.includes(existing.status)) {
      return badRequest(`Order is ${existing.status.toLowerCase()} and can no longer be deleted.`);
    }

    if (req.user.role === Role.MR) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee || existing.employeeId !== employee.id) {
        return forbidden("You may only delete orders you booked yourself");
      }
    }

    // Cascades to OrderItem and Invoice (both onDelete: Cascade in schema).
    // Restore the stock this order consumed first, or a deleted order
    // permanently loses that quantity from the warehouse count.
    await db.$transaction(async (tx) => {
      for (const item of existing.items) {
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: "MANUAL_ADJUSTMENT",
            delta: item.quantity,
            quantityAfter: updatedProduct.stockQty,
            note: `Order ${id.slice(0, 8).toUpperCase()} deleted — stock restored`,
          },
        });
      }
      await tx.order.delete({ where: { id } });
    });
    return ok({ message: "Order deleted" });
  } catch (err) {
    console.error("[DELETE /api/orders/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete order", 500);
  }
}

export const GET = withAuth(getOrder, [Role.MR, Role.ASM, Role.ADMIN, Role.DISTRIBUTOR, Role.MD]);
export const PUT = withAuth(updateOrder, [Role.MR, Role.ASM, Role.ADMIN, Role.MD, Role.WAREHOUSE]);
export const DELETE = withAuth(deleteOrder, [Role.MR, Role.ASM, Role.ADMIN]);
