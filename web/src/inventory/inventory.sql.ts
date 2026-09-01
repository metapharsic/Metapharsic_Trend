import { db } from "@/lib/db";
import { Prisma, InventoryMovementType } from "@prisma/client";

export class InventorySql {
  /**
   * Get warehouse stock overview with low stock thresholds
   */
  static async getWarehouseStock(lowStockThreshold = 300) {
    const [allProducts, lowStockProducts, movementAgg] = await Promise.all([
      db.product.findMany({
        orderBy: { name: "asc" },
      }),
      db.product.findMany({
        where: { stockQty: { lt: lowStockThreshold } },
        orderBy: { stockQty: "asc" },
      }),
      db.inventoryMovement.groupBy({
        by: ["type"],
        _count: { id: true },
        _sum: { delta: true },
      }),
    ]);

    return { allProducts, lowStockProducts, movementAgg };
  }

  /**
   * Query inventory movements with pagination and filters
   */
  static async findMovementsPaginated(params: {
    productId?: string;
    type?: InventoryMovementType;
    startDate?: Date;
    endDate?: Date;
    skip: number;
    take: number;
  }) {
    const where: Prisma.InventoryMovementWhereInput = {
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.startDate || params.endDate
        ? {
            createdAt: {
              ...(params.startDate ? { gte: params.startDate } : {}),
              ...(params.endDate ? { lte: params.endDate } : {}),
            },
          }
        : {}),
    };

    const [movements, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      db.inventoryMovement.count({ where }),
    ]);

    return { movements, total };
  }

  /**
   * Find MR sample inventories
   */
  static async getMrSampleInventory(employeeId: string) {
    return db.sampleInventory.findMany({
      where: { employeeId, quantity: { gt: 0 } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            ptr: true,
            mrp: true,
            price: true,
            currentBatchNo: true,
            currentExpDate: true,
          },
        },
      },
      orderBy: { product: { name: "asc" } },
    });
  }

  /**
   * Get MR sample allocation log history
   */
  static async getMrAllocationLogs(employeeId: string, limit = 50) {
    return db.sampleAllocationLog.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        allocatedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
