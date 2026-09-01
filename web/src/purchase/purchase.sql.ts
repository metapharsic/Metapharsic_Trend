import { db } from "@/lib/db";
import { TenderStatus } from "@prisma/client";

export class PurchaseSql {
  /**
   * List hospital tenders with filters and relations
   */
  static async findTenders(params: {
    hospitalId?: string;
    productId?: string;
    status?: TenderStatus;
    skip?: number;
    take?: number;
  }) {
    const where = {
      ...(params.hospitalId ? { hospitalId: params.hospitalId } : {}),
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [tenders, total] = await Promise.all([
      db.hospitalTender.findMany({
        where,
        skip: params.skip,
        take: params.take,
        include: {
          hospital: { select: { id: true, name: true, address: true } },
          product: { select: { id: true, name: true, sku: true, mrp: true, ptr: true, pts: true } },
        },
        orderBy: { validTo: "desc" },
      }),
      db.hospitalTender.count({ where }),
    ]);

    return { tenders, total };
  }

  /**
   * Find single tender by ID
   */
  static async findTenderById(id: string) {
    return db.hospitalTender.findUnique({
      where: { id },
      include: {
        hospital: true,
        product: true,
      },
    });
  }

  /**
   * List hospital formularies
   */
  static async findFormularies(hospitalId?: string) {
    return db.hospitalFormulary.findMany({
      where: hospitalId ? { hospitalId } : undefined,
      include: {
        hospital: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, mrp: true, therapySegment: true } },
      },
      orderBy: { product: { name: "asc" } },
    });
  }

  /**
   * List active discount schemes for product pricing calculation
   */
  static async findActiveDiscountSchemes(productId?: string) {
    const now = new Date();
    return db.discountScheme.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validTo: { gte: now },
        OR: [{ productId: null }, ...(productId ? [{ productId }] : [])],
      },
      orderBy: { discountPct: "desc" },
    });
  }
}
