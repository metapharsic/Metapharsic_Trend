import { db } from "@/lib/db";
import { Prisma, OrderStatus } from "@prisma/client";

export class SalesSql {
  /**
   * List sales orders with strict role scoping and server-side status aggregations
   */
  static async findOrdersPaginated(params: {
    status?: OrderStatus;
    employeeId?: string;
    chemistId?: string;
    distributorId?: string;
    startDate?: Date;
    endDate?: Date;
    skip: number;
    take: number;
  }) {
    const where: Prisma.OrderWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.chemistId ? { chemistId: params.chemistId } : {}),
      ...(params.distributorId ? { distributorId: params.distributorId } : {}),
      ...(params.startDate || params.endDate
        ? {
            createdAt: {
              ...(params.startDate ? { gte: params.startDate } : {}),
              ...(params.endDate ? { lte: params.endDate } : {}),
            },
          }
        : {}),
    };

    const scopeWhere: Prisma.OrderWhereInput = {
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.chemistId ? { chemistId: params.chemistId } : {}),
      ...(params.distributorId ? { distributorId: params.distributorId } : {}),
    };

    const [orders, total, statusGroups] = await Promise.all([
      db.order.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
        include: {
          chemist: { select: { id: true, name: true, creditLimit: true, billingName: true, gstNo: true, address: true } },
          doctor: { select: { id: true, fullName: true } },
          distributor: { select: { id: true, name: true, gstNo: true, address: true } },
          employee: { select: { id: true, firstName: true, lastName: true, phone: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, ptr: true, pts: true, mrp: true, hsnCode: true, gstPct: true },
              },
            },
          },
          invoice: true,
        },
      }),
      db.order.count({ where }),
      // KPI Status counts computed server-side across the entire scoped dataset
      db.order.groupBy({
        by: ["status"],
        where: scopeWhere,
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<OrderStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    for (const g of statusGroups) {
      statusCounts[g.status] = g._count._all;
    }

    return { orders, total, statusCounts };
  }

  /**
   * Find single order by ID with all relations
   */
  static async findOrderById(id: string) {
    return db.order.findUnique({
      where: { id },
      include: {
        chemist: true,
        doctor: true,
        distributor: true,
        employee: true,
        items: {
          include: {
            product: true,
          },
        },
        invoice: true,
      },
    });
  }

  /**
   * Find invoices scoped by employee or company-wide
   */
  static async findInvoices(employeeId?: string, limit = 500) {
    const where: Prisma.InvoiceWhereInput = employeeId
      ? { order: { employeeId } }
      : {};

    return db.invoice.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            employeeId: true,
            chemist: { select: { id: true, name: true } },
            distributor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Find payment collections
   */
  static async findCollections(employeeId?: string, chemistId?: string, limit = 100) {
    const where: Prisma.CollectionWhereInput = {
      ...(employeeId ? { employeeId } : {}),
      ...(chemistId ? { chemistId } : {}),
    };

    return db.collection.findMany({
      where,
      include: {
        chemist: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
