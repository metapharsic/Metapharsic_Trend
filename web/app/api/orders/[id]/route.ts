import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, unauthorized, apiError } from "@/lib/api-response";
import { UpdateOrderStatusSchema, UpdateOrderItemsSchema } from "@/lib/validators";
import { bestSchemeFor, round2 } from "@/lib/scheme";
import { computeInvoiceTotals } from "@/lib/gst";
import { postAutoLedger, reverseAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";
import { canTransitionOrder } from "@/lib/order-workflow";

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
        items: { include: { product: { select: { id: true, name: true, sku: true, pts: true, ptr: true, price: true } } } },
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

    // Admins and MDs have full privileges to transition or override any status.
    // Other roles follow the forward-only state machine.
    const isAdminOrMd = req.user.role === Role.ADMIN || req.user.role === Role.MD;
    if (!isAdminOrMd) {
      const transition = canTransitionOrder(existing.status, parsed.data.status);
      if (!transition.allowed) return badRequest(transition.reason ?? "Invalid status transition");
    }

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
  try {
    return await updateOrderItemsInner(req, id, body);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Insufficient stock")) {
      return badRequest(err.message);
    }
    console.error("[PUT /api/orders/[id]] (items edit)", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update order items", 500);
  }
}

async function updateOrderItemsInner(req: AuthedRequest, id: string, body: unknown) {
  const parsed = UpdateOrderItemsSchema.safeParse(body);
  if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

  const existing = await db.order.findUnique({ where: { id }, include: { invoice: true, items: true } });
  if (!existing) return notFound("Order not found");
  const isAdminOrMd = req.user.role === Role.ADMIN || req.user.role === Role.MD;
  if (!isAdminOrMd && LOCKED_STATUSES.includes(existing.status)) {
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
      const decremented = await tx.product.updateMany({
        where: { id: li.productId, stockQty: { gte: li.quantity } },
        data: { stockQty: { decrement: li.quantity } },
      });
      if (decremented.count === 0) {
        throw new Error(`Insufficient stock for product ${li.productId}`);
      }
      const updatedProduct = await tx.product.findUniqueOrThrow({ where: { id: li.productId } });
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
    const orderData: any = { items: { create: orderItemsData } };
    if (parsed.data.status) {
      orderData.status = parsed.data.status;
    }
    const order = await tx.order.update({
      where: { id },
      data: orderData,
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } }, chemist: true, distributor: true },
    });
    if (existing.invoice) {
      // If already paid, the recorded payment amount is about to go stale
      // against the new total — force it back to unpaid so the payment must
      // be explicitly re-confirmed against the correct new amount, rather
      // than silently keeping a "paid" flag that no longer matches the ledger.
      const wasPaid = existing.invoice.paid;
      const updatedInvoice = await tx.invoice.update({
        where: { orderId: id },
        data: {
          amount: newOrderValue,
          totalItems: gstTotals.totalItems,
          totalQty: gstTotals.totalQty,
          totalDiscount: gstTotals.totalDiscount,
          totalGst: gstTotals.totalGst,
          roundOff: gstTotals.roundOff,
          grandTotal: gstTotals.grandTotal,
          ...(wasPaid ? { paid: false } : {}),
        },
      });

      // Invoice total changed — the sale posting made at order-creation time
      // is now stale. Reverse it and repost fresh off the new totals, same as
      // the original create-time posting in orders/secondary/route.ts.
      await reverseAutoLedger(tx, "INVOICE", updatedInvoice.id);
      const gstAmount = Number(gstTotals.totalGst ?? 0);
      const grandTotal = Number(gstTotals.grandTotal ?? newOrderValue);
      const salesAmount = grandTotal - gstAmount;
      await postAutoLedger(tx, {
        sourceType: "INVOICE",
        sourceId: updatedInvoice.id,
        date: updatedInvoice.createdAt,
        narration: `Invoice ${updatedInvoice.invoiceNo} — edited`,
        lines: [
          { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, debit: grandTotal },
          { accountCode: SYSTEM_ACCOUNT_CODES.salesRevenue, credit: salesAmount },
          ...(gstAmount > 0 ? [{ accountCode: SYSTEM_ACCOUNT_CODES.gstPayable, credit: gstAmount }] : []),
        ],
      });

      // Payment posting (sourceId `${id}-payment`) reflected the OLD amount —
      // reverse it now that `paid` has been forced back to false above; a
      // fresh PUT /api/invoices/[id] { paid: true } will re-post correctly
      // against the new total.
      if (wasPaid) {
        await reverseAutoLedger(tx, "INVOICE", `${updatedInvoice.id}-payment`);
      }
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
    const existing = await db.order.findUnique({ where: { id }, include: { items: true, invoice: true } });
    if (!existing) return notFound("Order not found");
    const isAdminOrMd = req.user.role === Role.ADMIN || req.user.role === Role.MD;
    if (!isAdminOrMd && LOCKED_STATUSES.includes(existing.status)) {
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
      // Order delete cascades to Invoice (schema onDelete: Cascade) — the
      // ledger postings keyed off that invoice id must be cleared too, or
      // they'd orphan as a sale/payment for an invoice that no longer exists.
      if (existing.invoice) {
        await reverseAutoLedger(tx, "INVOICE", existing.invoice.id);
        if (existing.invoice.paid) {
          await reverseAutoLedger(tx, "INVOICE", `${existing.invoice.id}-payment`);
        }
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
export const DELETE = withAuth(deleteOrder, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
