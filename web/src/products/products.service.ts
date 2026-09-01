import { db } from "@/lib/db";
import { ProductsSql } from "./products.sql";
import { CreateProductInput, UpdateProductInput, ProductQueryInput } from "./products.schema";

export class ProductsService {
  /**
   * List products with pagination, search, therapy segment filter,
   * 30-day burn rate forecasting, and stock value calculations.
   */
  static async listProducts(query: ProductQueryInput) {
    const { page, limit, search, therapySegment } = query;
    const skip = (page - 1) * limit;

    const { products, total } = await ProductsSql.findManyPaginated({
      search,
      therapySegment,
      skip,
      take: limit,
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const productIds = products.map((p) => p.id);

    const [recentDeductions, lastMovements] = await Promise.all([
      ProductsSql.get30DayOrderDeductions(productIds, thirtyDaysAgo),
      ProductsSql.getLatestMovements(productIds),
    ]);

    const burnByProduct = new Map(
      recentDeductions.map((r) => [r.productId, Math.abs(r._sum.delta ?? 0) / 30])
    );
    const lastMovementByProduct = new Map(
      lastMovements.map((m) => [m.productId, m.createdAt])
    );

    const enriched = products.map((p) => {
      const rate = burnByProduct.get(p.id) ?? 0;
      const unitValue = Number(p.ptr ?? p.price);
      return {
        ...p,
        stockValue: Math.round(p.stockQty * unitValue * 100) / 100,
        lastMovementAt: lastMovementByProduct.get(p.id) ?? p.updatedAt,
        forecast: {
          burnRatePerDay: Math.round(rate * 100) / 100,
          daysRemaining: rate > 0 ? Math.floor(p.stockQty / rate) : null,
        },
      };
    });

    return {
      products: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single product by ID
   */
  static async getProductById(id: string) {
    return ProductsSql.findById(id);
  }

  /**
   * Create a new product SKU with pricing and batch defaults
   */
  static async createProduct(data: CreateProductInput, employeeId?: string | null) {
    return db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...data,
          stockQty: data.stockQty ?? 0,
        },
      });

      if (data.stockQty && data.stockQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            type: "RESTOCK",
            delta: data.stockQty,
            quantityAfter: data.stockQty,
            employeeId: employeeId ?? null,
            note: "Initial stock on product creation",
          },
        });
      }

      return product;
    });
  }

  /**
   * Update product and log stock audit movement if stockQty changed
   */
  static async updateProduct(id: string, data: UpdateProductInput, userId?: string) {
    const existing = await ProductsSql.findById(id);
    if (!existing) return null;

    const stockChanged = data.stockQty !== undefined && data.stockQty !== existing.stockQty;
    const employee = stockChanged && userId
      ? await db.employee.findUnique({ where: { userId } })
      : null;

    return db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data,
      });

      if (stockChanged) {
        await tx.inventoryMovement.create({
          data: {
            productId: id,
            type: "MANUAL_ADJUSTMENT",
            delta: data.stockQty! - existing.stockQty,
            quantityAfter: data.stockQty!,
            employeeId: employee?.id ?? null,
            note: "Manual stock edit via Inventory",
          },
        });
      }

      return updated;
    });
  }

  /**
   * Safely delete product and cascade dependent records
   */
  static async deleteProduct(id: string) {
    const existing = await ProductsSql.findById(id);
    if (!existing) return false;

    await db.$transaction(async (tx) => {
      // 1. Delete associated claims and credit notes
      await tx.creditNote.deleteMany({ where: { claim: { productId: id } } });
      await tx.claim.deleteMany({ where: { productId: id } });

      // 2. Identify and clean up related order items
      const orderItems = await tx.orderItem.findMany({
        where: { productId: id },
        select: { orderId: true },
      });
      const orderIds = [...new Set(orderItems.map((oi) => oi.orderId))];

      await tx.orderItem.deleteMany({ where: { productId: id } });

      // If any order has zero remaining line items, remove it
      for (const orderId of orderIds) {
        const remaining = await tx.orderItem.count({ where: { orderId } });
        if (remaining === 0) {
          await tx.invoice.deleteMany({ where: { orderId } });
          await tx.order.delete({ where: { id: orderId } });
        }
      }

      // 3. Delete dependent catalog, audit, and sample entries
      await tx.hospitalFormulary.deleteMany({ where: { productId: id } });
      await tx.discountScheme.deleteMany({ where: { productId: id } });
      await tx.hospitalTender.deleteMany({ where: { productId: id } });
      await tx.prescriptionHistory.deleteMany({ where: { productId: id } });
      await tx.sample.deleteMany({ where: { productId: id } });
      await tx.sampleInventory.deleteMany({ where: { productId: id } });
      await tx.sampleAllocationLog.deleteMany({ where: { productId: id } });
      await tx.visualAid.deleteMany({ where: { productId: id } });
      await tx.inventoryMovement.deleteMany({ where: { productId: id } });

      // 4. Delete the product
      await tx.product.delete({ where: { id } });
    });

    return true;
  }

  /**
   * Get movement history for a product
   */
  static async getProductMovements(id: string, limit = 100) {
    const product = await db.product.findUnique({
      where: { id },
      select: { id: true, name: true, stockQty: true },
    });
    if (!product) return null;

    const movements = await ProductsSql.getProductMovementHistory(id, limit);
    return { product, movements };
  }
}
