import { db } from "@/lib/db";
import { OrderStatus, ExpenseStatus } from "@prisma/client";

export class ReportsSql {
  /**
   * Product-wise sales & SKU velocity
   */
  static async getProductSalesData(territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) {
    return db.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          status: OrderStatus.DELIVERED,
          ...(territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : {}),
        },
      },
      include: { product: true },
    });
  }

  /**
   * Doctor DPS tiering and visit adherence
   */
  static async getDoctorDpsData(territoryIds: string[] | null) {
    return db.doctor.findMany({
      where: territoryIds ? { territoryId: { in: territoryIds } } : {},
      include: {
        territory: { select: { id: true, name: true } },
        visits: { select: { id: true, createdAt: true, cqsScore: true } },
        prescriptionHistories: { include: { product: { select: { name: true } } } },
      },
      orderBy: { dpsScore: "desc" },
    });
  }

  /**
   * Chemist aging and credit risk analysis
   */
  static async getChemistAgingData(territoryIds: string[] | null) {
    return db.chemist.findMany({
      where: territoryIds ? { territoryId: { in: territoryIds } } : {},
      include: {
        territory: { select: { id: true, name: true } },
        orders: {
          where: { status: OrderStatus.DELIVERED },
          include: { invoice: true, items: true },
        },
        collections: true,
        ledgers: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  /**
   * Sample & gift distribution audit
   */
  static async getSampleGiftAuditData(territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) {
    const [sampleInventories, samplesDistributed, giftsDistributed] = await Promise.all([
      db.sampleInventory.findMany({
        include: {
          product: { select: { id: true, name: true, sku: true, ptr: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      db.sample.findMany({
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          ...(territoryIds ? { visit: { employee: { territories: { some: { id: { in: territoryIds } } } } } } : {}),
        },
        include: {
          product: true,
          visit: { include: { doctor: true, employee: true } },
        },
      }),
      db.gift.findMany({
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          ...(territoryIds ? { visit: { employee: { territories: { some: { id: { in: territoryIds } } } } } } : {}),
        },
        include: {
          giftCatalog: true,
          visit: { include: { doctor: true, employee: true } },
        },
      }),
    ]);

    return { sampleInventories, samplesDistributed, giftsDistributed };
  }

  /**
   * Tour plan and routing compliance
   */
  static async getTourPlanComplianceData(territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) {
    return db.tourPlan.findMany({
      where: {
        createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
        ...(territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        days: { include: { territory: true, plannedDoctor: true } },
      },
    });
  }

  /**
   * GST tax summary for filed invoices
   */
  static async getGstTaxSummaryData(dateRange: { startDate: Date; endDate?: Date }) {
    return db.invoice.findMany({
      where: {
        createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
      },
      include: {
        order: {
          include: {
            items: { include: { product: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
