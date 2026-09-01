import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export class ProductsSql {
  /**
   * Find product by ID with full attributes
   */
  static async findById(id: string) {
    return db.product.findUnique({
      where: { id },
    });
  }

  /**
   * Find product by SKU
   */
  static async findBySku(sku: string) {
    return db.product.findUnique({
      where: { sku },
    });
  }

  /**
   * Search and paginate products with total count
   */
  static async findManyPaginated(params: {
    search?: string;
    therapySegment?: string;
    skip: number;
    take: number;
  }) {
    const where: Prisma.ProductWhereInput = {
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { sku: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(params.therapySegment ? { therapySegment: params.therapySegment } : {}),
    };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { name: "asc" },
      }),
      db.product.count({ where }),
    ]);

    return { products, total };
  }

  /**
   * Get 30-day order deduction aggregates for product burn rate forecasting
   */
  static async get30DayOrderDeductions(productIds: string[], thirtyDaysAgo: Date) {
    return db.inventoryMovement.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        type: "ORDER_DEDUCTION",
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { delta: true },
    });
  }

  /**
   * Get the most recent inventory movement timestamp for a set of products
   */
  static async getLatestMovements(productIds: string[]) {
    return db.inventoryMovement.findMany({
      where: { productId: { in: productIds } },
      orderBy: { createdAt: "desc" },
      distinct: ["productId"],
      select: { productId: true, createdAt: true },
    });
  }

  /**
   * Fetch 100 most recent movements for a specific product
   */
  static async getProductMovementHistory(productId: string, limit = 100) {
    return db.inventoryMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
  }
}
