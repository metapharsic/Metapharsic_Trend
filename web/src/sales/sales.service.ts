import { db } from "@/lib/db";
import { OrderStatus, InventoryMovementType } from "@prisma/client";
import { SalesSql } from "./sales.sql";
import {
  CreateSalesOrderInput,
  UpdateOrderStatusInput,
  RecordCollectionInput,
  GenerateInvoiceInput,
  SalesOrderQueryInput,
} from "./sales.schema";
import { bestSchemeFor, round2 } from "@/lib/scheme";
import { outstandingBalance, canPlaceOrder } from "@/lib/credit";
import { computeInvoiceTotals } from "@/lib/gst";
import { postAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";

export class SalesService {
  /**
   * List sales orders with strict scoping and server-side pagination & aggregates
   */
  static async listOrders(query: SalesOrderQueryInput, employeeIdFilter?: string) {
    const { page, limit, status, chemistId, distributorId, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const { orders, total, statusCounts } = await SalesSql.findOrdersPaginated({
      status,
      employeeId: employeeIdFilter ?? query.employeeId,
      chemistId,
      distributorId,
      startDate,
      endDate,
      skip,
      take: limit,
    });

    return {
      orders,
      statusCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single order by ID
   */
  static async getOrderById(id: string) {
    return SalesSql.findOrderById(id);
  }

  /**
   * Create secondary sales order with batch snapshots, scheme application, and credit check
   */
  static async createOrder(data: CreateSalesOrderInput, employeeId?: string | null) {
    // 1. Credit Check if booked for a Chemist
    if (data.chemistId) {
      const chemist = await db.chemist.findUnique({
        where: { id: data.chemistId },
        select: { creditLimit: true },
      });
      if (chemist && chemist.creditLimit) {
        const [collections, orders] = await Promise.all([
          db.collection.aggregate({
            where: { chemistId: data.chemistId },
            _sum: { amount: true },
          }),
          db.order.aggregate({
            where: { chemistId: data.chemistId },
            _sum: { amount: true },
          }),
        ]);
        const totalOrdered = Number(orders._sum.amount || 0);
        const totalCollected = Number(collections._sum.amount || 0);
        const outstanding = outstandingBalance(totalOrdered, totalCollected);
        const orderVal = data.items.reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0);
        const creditGuard = canPlaceOrder({ creditLimit: Number(chemist.creditLimit), outstanding }, orderVal);
        if (!creditGuard.allowed) {
          throw new Error(`Credit limit exceeded: ${creditGuard.reason}`);
        }
      }
    }

    // 2. Fetch products and active discount schemes
    const productIds = data.items.map((i) => i.productId);
    const [products, schemes] = await Promise.all([
      db.product.findMany({ where: { id: { in: productIds } } }),
      db.discountScheme.findMany({
        where: {
          isActive: true,
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
        },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Prepare snapshot line items
    const preparedItems = data.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      let discountPct = item.discountPct ?? 0;
      if (data.applyBestScheme && discountPct === 0) {
        const matchingScheme = bestSchemeFor(schemes, product.id, item.quantity);
        if (matchingScheme) {
          discountPct = matchingScheme.discountPct;
        }
      }

      const unitPrice = item.price ?? Number(product.ptr ?? product.price ?? 0);

      return {
        productId: product.id,
        quantity: item.quantity,
        price: unitPrice,
        hsnCode: item.hsnCode ?? product.hsnCode ?? "30049099",
        batchNo: item.batchNo ?? product.currentBatchNo ?? "BATCH-DEFAULT",
        mfgDate: item.mfgDate ?? product.currentMfgDate ?? new Date(),
        expDate: item.expDate ?? product.currentExpDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        packSize: item.packSize ?? product.packSize ?? "N/A",
        freeQty: item.freeQty ?? 0,
        mrp: item.mrp ?? Number(product.mrp ?? product.price ?? 0),
        discountPct,
        gstPct: item.gstPct ?? Number(product.gstPct ?? 12),
      };
    });

    // 4. Create Order and snapshotted OrderItems in a transaction
    return db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          status: OrderStatus.PENDING,
          chemistId: data.chemistId ?? null,
          doctorId: data.doctorId ?? null,
          distributorId: data.distributorId,
          employeeId: employeeId ?? null,
          items: {
            create: preparedItems,
          },
        },
        include: {
          chemist: true,
          distributor: true,
          items: {
            include: { product: true },
          },
        },
      });

      return order;
    });
  }

  /**
   * Update Order status lifecycle (e.g. PENDING -> CONFIRMED -> SHIPPED -> DELIVERED)
   */
  static async updateOrderStatus(id: string, data: UpdateOrderStatusInput, employeeId?: string | null) {
    const existing = await db.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return null;

    return db.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: data.status },
        include: {
          chemist: true,
          distributor: true,
          items: { include: { product: true } },
          invoice: true,
        },
      });

      // If status transitioned to DELIVERED, perform inventory stock deduction
      if (data.status === OrderStatus.DELIVERED && existing.status !== OrderStatus.DELIVERED) {
        for (const item of existing.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod) {
            const totalDeducted = item.quantity + (item.freeQty || 0);
            const remaining = Math.max(prod.stockQty - totalDeducted, 0);

            await tx.product.update({
              where: { id: item.productId },
              data: { stockQty: remaining },
            });

            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                type: InventoryMovementType.ORDER_DEDUCTION,
                delta: -totalDeducted,
                quantityAfter: remaining,
                employeeId: employeeId ?? null,
                note: `Delivered Order #${id.slice(0, 8)}`,
              },
            });
          }
        }
      }

      return updatedOrder;
    });
  }

  /**
   * Generate official GST Invoice for an Order with immutable party snapshot
   */
  static async generateInvoice(data: GenerateInvoiceInput) {
    const order = await db.order.findUnique({
      where: { id: data.orderId },
      include: {
        chemist: true,
        distributor: true,
        items: { include: { product: true } },
        invoice: true,
      },
    });

    if (!order) throw new Error("Order not found");
    if (order.invoice) return order.invoice; // Already generated

    const companySettings = await db.companySettings.findFirst({
      where: { id: "singleton" },
    });

    const party = order.chemist ?? order.distributor;
    const gstLines = order.items.map((i) => ({
      price: Number(i.price),
      quantity: i.quantity,
      discountPct: Number(i.discountPct),
      gstPct: Number(i.gstPct),
    }));

    const totals = computeInvoiceTotals(gstLines);
    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;

    return db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          orderId: order.id,
          invoiceNo,
          amount: totals.grandTotal,
          paid: false,
          partyName: party ? party.name : "Cash Customer",
          partyGstNo: (party as any)?.gstNo ?? null,
          partyAddress: (party as any)?.address ?? null,
          partyDlNo: (party as any)?.licenseNo ?? null,
          partyPhone: (party as any)?.mobile ?? null,
          lrNo: data.lrNo ?? null,
          lrDate: data.lrDate ?? null,
          cases: data.cases ?? 1,
          dueDate: data.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          transport: data.transport ?? "Local Courier",
          vehicleNo: data.vehicleNo ?? null,
          totalItems: order.items.length,
          totalQty: totals.totalQuantity,
          totalDiscount: totals.totalDiscount,
          totalGst: totals.totalGst,
          roundOff: totals.roundOff,
          grandTotal: totals.grandTotal,
        },
      });

      // Post auto double-entry ledger entry
      try {
        await postAutoLedger(tx, {
          date: new Date(),
          narration: `Invoice ${invoiceNo} raised for ${party?.name || "Customer"}`,
          sourceType: "INVOICE",
          sourceId: invoice.id,
          lines: [
            { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, debit: totals.grandTotal, credit: 0 },
            { accountCode: SYSTEM_ACCOUNT_CODES.salesRevenue, debit: 0, credit: totals.grandTotal },
          ],
        });
      } catch (e) {
        console.warn("[Invoice] Ledger posting skipped or failed:", e);
      }

      return invoice;
    });
  }

  /**
   * Record payment collection from Chemist
   */
  static async recordCollection(data: RecordCollectionInput, employeeId: string) {
    return db.$transaction(async (tx) => {
      const collection = await tx.collection.create({
        data: {
          chemistId: data.chemistId,
          employeeId,
          amount: data.amount,
          refNumber: data.refNumber ?? `REC-${Date.now().toString().slice(-6)}`,
        },
        include: {
          chemist: true,
          employee: true,
        },
      });

      // Post auto ledger
      try {
        await postAutoLedger(tx, {
          date: new Date(),
          narration: `Payment collection of ₹${data.amount} from ${collection.chemist.name} (Ref: ${collection.refNumber})`,
          sourceType: "COLLECTION",
          sourceId: collection.id,
          lines: [
            { accountCode: SYSTEM_ACCOUNT_CODES.bank, debit: data.amount, credit: 0 },
            { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, debit: 0, credit: data.amount },
          ],
        });
      } catch (e) {
        console.warn("[Collection] Ledger posting skipped:", e);
      }

      return collection;
    });
  }

  /**
   * List invoices scoped by MR or company-wide
   */
  static async listInvoices(employeeId?: string) {
    return SalesSql.findInvoices(employeeId);
  }
}
