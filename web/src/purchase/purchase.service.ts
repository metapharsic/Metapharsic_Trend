import { db } from "@/lib/db";
import { PurchaseSql } from "./purchase.sql";
import {
  CreatePurchaseOrderInput,
  InwardStockReceiptInput,
  CreateHospitalTenderInput,
  UpdateTenderStatusInput,
  CreateHospitalFormularyInput,
  CreateDiscountSchemeInput,
  PurchaseQueryInput,
} from "./purchase.schema";

export class PurchaseService {
  /**
   * Process a single inward stock receipt (GRN)
   * Updates product stockQty, currentBatchNo, mfg/exp dates and creates RESTOCK movement
   */
  static async processInwardStock(data: InwardStockReceiptInput, employeeId?: string | null) {
    const product = await db.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new Error("Product not found");

    const newStockQty = product.stockQty + data.quantity;

    return db.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: {
          stockQty: newStockQty,
          currentBatchNo: data.batchNo,
          currentMfgDate: data.mfgDate,
          currentExpDate: data.expDate,
        },
      });

      const note = data.note ?? `GRN Inward Stock: ${data.grnNumber || "Auto"} from ${data.supplierName || "Supplier"}`;
      const movement = await tx.inventoryMovement.create({
        data: {
          productId: data.productId,
          type: "RESTOCK",
          delta: data.quantity,
          quantityAfter: newStockQty,
          employeeId: employeeId ?? null,
          note,
        },
      });

      return { product: updatedProduct, movement };
    });
  }

  /**
   * Process full supplier purchase order inwarding
   */
  static async processPurchaseOrder(data: CreatePurchaseOrderInput, employeeId?: string | null) {
    return db.$transaction(async (tx) => {
      const results = [];

      for (const item of data.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);

        const newStockQty = product.stockQty + item.quantity;

        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQty: newStockQty,
            currentBatchNo: item.batchNo,
            currentMfgDate: item.mfgDate,
            currentExpDate: item.expDate,
            ...(item.hsnCode ? { hsnCode: item.hsnCode } : {}),
            ...(item.gstPct ? { gstPct: item.gstPct } : {}),
          },
        });

        const note = `PO Inward: ${data.supplierName} (Inv: ${data.invoiceNumber || "N/A"}) - Batch ${item.batchNo}`;
        const movement = await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: "RESTOCK",
            delta: item.quantity,
            quantityAfter: newStockQty,
            employeeId: employeeId ?? null,
            note,
          },
        });

        results.push({ product: updatedProduct, movement });
      }

      return {
        supplierName: data.supplierName,
        invoiceNumber: data.invoiceNumber,
        processedItemsCount: results.length,
        items: results,
      };
    });
  }

  /**
   * Create hospital tender rate contract
   */
  static async createHospitalTender(data: CreateHospitalTenderInput) {
    if (data.validTo < data.validFrom) {
      throw new Error("validTo must be on or after validFrom");
    }

    return db.hospitalTender.create({
      data,
      include: {
        hospital: true,
        product: true,
      },
    });
  }

  /**
   * Update tender status (DRAFT, SUBMITTED, WON, LOST, EXPIRED)
   */
  static async updateTenderStatus(id: string, data: UpdateTenderStatusInput) {
    const tender = await db.hospitalTender.findUnique({ where: { id } });
    if (!tender) return null;

    return db.hospitalTender.update({
      where: { id },
      data: { status: data.status },
      include: {
        hospital: true,
        product: true,
      },
    });
  }

  /**
   * List tenders with pagination
   */
  static async listTenders(query: PurchaseQueryInput) {
    const { page, limit, hospitalId, productId, status } = query;
    const skip = (page - 1) * limit;

    const { tenders, total } = await PurchaseSql.findTenders({
      hospitalId,
      productId,
      status,
      skip,
      take: limit,
    });

    return {
      tenders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Upsert hospital formulary inclusion
   */
  static async setHospitalFormulary(data: CreateHospitalFormularyInput) {
    return db.hospitalFormulary.upsert({
      where: {
        hospitalId_productId: {
          hospitalId: data.hospitalId,
          productId: data.productId,
        },
      },
      update: {
        included: data.included,
        notes: data.notes,
        reviewedAt: new Date(),
      },
      create: {
        hospitalId: data.hospitalId,
        productId: data.productId,
        included: data.included,
        notes: data.notes,
        reviewedAt: new Date(),
      },
      include: {
        hospital: true,
        product: true,
      },
    });
  }

  /**
   * Create trade discount scheme
   */
  static async createDiscountScheme(data: CreateDiscountSchemeInput) {
    if (data.validTo < data.validFrom) {
      throw new Error("validTo must be on or after validFrom");
    }

    return db.discountScheme.create({
      data,
      include: {
        product: true,
      },
    });
  }
}
