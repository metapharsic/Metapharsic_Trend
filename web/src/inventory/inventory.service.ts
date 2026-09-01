import { db } from "@/lib/db";
import { InventorySql } from "./inventory.sql";
import {
  StockAdjustmentInput,
  RestockInput,
  SampleAllocationInput,
  BatchSampleAllocationInput,
  InventoryMovementQueryInput,
} from "./inventory.schema";

export class InventoryService {
  /**
   * Adjust product stock with full audit trail
   */
  static async adjustStock(data: StockAdjustmentInput, employeeId?: string | null) {
    const product = await db.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new Error("Product not found");

    const newQuantity = product.stockQty + data.delta;
    if (newQuantity < 0) {
      throw new Error(`Insufficient stock. Current: ${product.stockQty}, Adjustment: ${data.delta}`);
    }

    return db.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: { stockQty: newQuantity },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: data.productId,
          type: data.type,
          delta: data.delta,
          quantityAfter: newQuantity,
          employeeId: employeeId ?? null,
          note: data.note ?? "Manual stock adjustment",
        },
      });

      return { product: updatedProduct, movement };
    });
  }

  /**
   * Restock product with optional batch and expiry dates
   */
  static async restock(data: RestockInput, employeeId?: string | null) {
    const product = await db.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new Error("Product not found");

    const newQuantity = product.stockQty + data.quantity;

    return db.$transaction(async (tx) => {
      const updateData: any = {
        stockQty: newQuantity,
      };

      if (data.batchNo) updateData.currentBatchNo = data.batchNo;
      if (data.mfgDate) updateData.currentMfgDate = data.mfgDate;
      if (data.expDate) updateData.currentExpDate = data.expDate;

      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: updateData,
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: data.productId,
          type: "RESTOCK",
          delta: data.quantity,
          quantityAfter: newQuantity,
          employeeId: employeeId ?? null,
          note: data.note ?? `Restock (Batch: ${data.batchNo || product.currentBatchNo || "N/A"})`,
        },
      });

      return { product: updatedProduct, movement };
    });
  }

  /**
   * Allocate samples to an MR with audit log and inventory upsert
   */
  static async allocateSampleToMr(data: SampleAllocationInput, allocatorEmployeeId?: string | null) {
    const product = await db.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new Error("Product not found");

    return db.$transaction(async (tx) => {
      // Upsert MR SampleInventory
      const sampleInv = await tx.sampleInventory.upsert({
        where: {
          employeeId_productId: {
            employeeId: data.employeeId,
            productId: data.productId,
          },
        },
        update: {
          quantity: { increment: data.quantity },
          allocatedQty: { increment: data.quantity },
        },
        create: {
          employeeId: data.employeeId,
          productId: data.productId,
          quantity: data.quantity,
          allocatedQty: data.quantity,
        },
      });

      // Log allocation history
      const log = await tx.sampleAllocationLog.create({
        data: {
          employeeId: data.employeeId,
          productId: data.productId,
          quantity: data.quantity,
          allocatedById: allocatorEmployeeId ?? null,
        },
      });

      return { sampleInventory: sampleInv, log };
    });
  }

  /**
   * Batch allocate multiple sample SKUs to an MR
   */
  static async batchAllocateSamples(data: BatchSampleAllocationInput, allocatorEmployeeId?: string | null) {
    return db.$transaction(async (tx) => {
      const results = [];
      for (const item of data.allocations) {
        const sampleInv = await tx.sampleInventory.upsert({
          where: {
            employeeId_productId: {
              employeeId: data.employeeId,
              productId: item.productId,
            },
          },
          update: {
            quantity: { increment: item.quantity },
            allocatedQty: { increment: item.quantity },
          },
          create: {
            employeeId: data.employeeId,
            productId: item.productId,
            quantity: item.quantity,
            allocatedQty: item.quantity,
          },
        });

        const log = await tx.sampleAllocationLog.create({
          data: {
            employeeId: data.employeeId,
            productId: item.productId,
            quantity: item.quantity,
            allocatedById: allocatorEmployeeId ?? null,
          },
        });

        results.push({ sampleInventory: sampleInv, log });
      }
      return results;
    });
  }

  /**
   * Get MR sample inventory with valuations
   */
  static async getMrSamples(employeeId: string) {
    const samples = await InventorySql.getMrSampleInventory(employeeId);
    const withValue = samples.map((s) => {
      const unitValue = Number(s.product.ptr ?? s.product.price ?? 0);
      return {
        productId: s.productId,
        productName: s.product.name,
        sku: s.product.sku,
        batchNo: s.product.currentBatchNo,
        expDate: s.product.currentExpDate,
        quantity: s.quantity,
        allocatedQty: s.allocatedQty,
        unitValue,
        estimatedValue: unitValue * s.quantity,
        lastGivenAt: s.updatedAt,
      };
    });

    const totalEstimatedValue = withValue.reduce((sum, s) => sum + s.estimatedValue, 0);
    return { samples: withValue, totalEstimatedValue };
  }

  /**
   * List inventory movements paginated
   */
  static async listMovements(query: InventoryMovementQueryInput) {
    const { page, limit, productId, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const { movements, total } = await InventorySql.findMovementsPaginated({
      productId,
      type,
      startDate,
      endDate,
      skip,
      take: limit,
    });

    return {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get warehouse stock overview and critical alerts
   */
  static async getWarehouseDashboard(lowStockThreshold = 300) {
    const { allProducts, lowStockProducts, movementAgg } = await InventorySql.getWarehouseStock(lowStockThreshold);

    const totalStockUnits = allProducts.reduce((sum, p) => sum + p.stockQty, 0);
    const totalInventoryValue = allProducts.reduce(
      (sum, p) => sum + p.stockQty * Number(p.ptr ?? p.price ?? 0),
      0
    );

    return {
      kpis: {
        totalProducts: allProducts.length,
        totalStockUnits,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        lowStockAlertsCount: lowStockProducts.length,
      },
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stockQty: p.stockQty,
        threshold: lowStockThreshold,
        currentBatchNo: p.currentBatchNo,
        currentExpDate: p.currentExpDate,
      })),
      movementAggregates: movementAgg,
    };
  }
}
