import { db } from "@/lib/db";
import { Prisma, OrderStatus } from "@prisma/client";
import { computeInvoiceTotals } from "@/lib/gst";
import { postAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";
import { profitFor, type ProfitLine } from "@/lib/pricing";

export type InvoicingCadence = "ALL" | "DAILY" | "MONTHLY" | "QUARTERLY";

export interface InvoicingFilterParams {
  cadence?: InvoicingCadence;
  date?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM
  quarter?: string; // e.g. "Q1", "Q2", "Q3", "Q4" or "2026-Q4"
  year?: number;
  territoryId?: string;
  subArea?: string;
  employeeId?: string;
  paid?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AreaInvoiceBreakdown {
  territoryId: string;
  territoryName: string;
  subArea?: string | null;
  totalInvoiced: number;
  invoiceCount: number;
  paidAmount: number;
  unpaidAmount: number;
  pendingOrdersCount: number;
  pendingOrdersAmount: number;
}

export interface PersonInvoiceBreakdown {
  employeeId: string;
  employeeName: string;
  role: string;
  phone?: string | null;
  totalInvoiced: number;
  invoiceCount: number;
  paidAmount: number;
  unpaidAmount: number;
  pendingOrdersCount: number;
  pendingOrdersAmount: number;
}

export interface CadenceBucketSummary {
  bucketKey: string;
  bucketLabel: string;
  startDate: string;
  endDate: string;
  invoicedAmount: number;
  invoiceCount: number;
  paidAmount: number;
  unpaidAmount: number;
  pendingOrdersCount: number;
  pendingOrdersAmount: number;
}

export interface InvoicingDashboardResult {
  summary: {
    totalInvoicedAmount: number;
    totalInvoicesCount: number;
    totalPaidAmount: number;
    totalUnpaidAmount: number;
    totalPendingOrdersCount: number;
    totalPendingOrdersAmount: number;
    cadence: InvoicingCadence;
    filterDate?: string;
    filterMonth?: string;
    filterQuarter?: string;
  };
  cadenceBreakdowns: CadenceBucketSummary[];
  areaBreakdowns: AreaInvoiceBreakdown[];
  personBreakdowns: PersonInvoiceBreakdown[];
  uninvoicedOrders: Array<{
    id: string;
    orderDate: string;
    amount: number;
    chemistName: string;
    doctorName?: string | null;
    territoryName: string;
    subArea?: string | null;
    employeeName: string;
    itemsCount: number;
  }>;
}

export class InvoicingService {
  /**
   * Helper to calculate start & end Date bounds based on Cadence.
   */
  public static getCadenceDateRange(params: InvoicingFilterParams): { gte?: Date; lte?: Date } {
    const year = params.year || new Date().getFullYear();

    if (params.cadence === "DAILY" && params.date) {
      const start = new Date(`${params.date}T00:00:00.000Z`);
      const end = new Date(`${params.date}T23:59:59.999Z`);
      return { gte: start, lte: end };
    }

    if (params.cadence === "MONTHLY" && params.month) {
      const [yStr, mStr] = params.month.split("-");
      const y = parseInt(yStr, 10) || year;
      const m = parseInt(mStr, 10) - 1; // 0-based
      const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
      const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      return { gte: start, lte: end };
    }

    if (params.cadence === "QUARTERLY" && params.quarter) {
      // Handles "Q1", "Q2", "Q3", "Q4" or "2026-Q1"
      let qStr = params.quarter;
      let y = year;
      if (qStr.includes("-")) {
        const parts = qStr.split("-");
        y = parseInt(parts[0], 10) || year;
        qStr = parts[1];
      }
      const qNum = parseInt(qStr.replace(/\D/g, ""), 10) || 1;
      // Standard Financial/Calendar quarters (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
      const startMonth = (qNum - 1) * 3;
      const start = new Date(Date.UTC(y, startMonth, 1, 0, 0, 0));
      const end = new Date(Date.UTC(y, startMonth + 3, 0, 23, 59, 59, 999));
      return { gte: start, lte: end };
    }

    return {};
  }

  /**
   * Retrieves comprehensive Invoicing Dashboard analytics:
   * - Daily, Monthly, and Quarterly breakdowns
   * - Area-wise (Territory & Sub-area) aggregations
   * - Person-wise (MR / Rep) aggregations
   * - Real-time un-invoiced orders queue awaiting batch generation
   */
  public static async getInvoicingDashboard(params: InvoicingFilterParams): Promise<InvoicingDashboardResult> {
    const cadence = params.cadence || "ALL";
    const dateRange = this.getCadenceDateRange(params);

    // ── 1. Fetch Invoices with full relational dimensions ──
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      ...(dateRange.gte || dateRange.lte ? { createdAt: dateRange } : {}),
      ...(params.paid !== undefined ? { paid: params.paid } : {}),
      ...(params.territoryId
        ? {
            order: {
              chemist: { territoryId: params.territoryId },
            },
          }
        : {}),
      ...(params.subArea
        ? {
            order: {
              chemist: { subArea: { equals: params.subArea, mode: "insensitive" } },
            },
          }
        : {}),
      ...(params.employeeId
        ? {
            order: {
              employeeId: params.employeeId,
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { invoiceNo: { contains: params.search, mode: "insensitive" } },
              { partyName: { contains: params.search, mode: "insensitive" } },
              { order: { chemist: { name: { contains: params.search, mode: "insensitive" } } } },
              { order: { doctor: { fullName: { contains: params.search, mode: "insensitive" } } } },
              { order: { employee: { firstName: { contains: params.search, mode: "insensitive" } } } },
              { order: { employee: { lastName: { contains: params.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const allInvoices = await db.invoice.findMany({
      where: invoiceWhere,
      include: {
        order: {
          select: {
            id: true,
            createdAt: true,
            employeeId: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                user: {
                  select: {
                    role: true,
                  },
                },
              },
            },
            chemistId: true,
            chemist: {
              select: {
                id: true,
                name: true,
                subArea: true,
                beatName: true,
                territoryId: true,
                territory: { select: { id: true, name: true } },
              },
            },
            doctorId: true,
            doctor: {
              select: {
                id: true,
                fullName: true,
                primarySpecialty: true,
                clinicAddress: true,
                registrationNo: true,
              },
            },
            items: {
              select: {
                quantity: true,
                freeQty: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // ── 2. Fetch Un-invoiced Orders (Pending Generation) ──
    const uninvoicedOrderWhere: Prisma.OrderWhereInput = {
      invoice: null,
      status: { not: OrderStatus.CANCELLED },
      ...(dateRange.gte || dateRange.lte ? { createdAt: dateRange } : {}),
      ...(params.territoryId ? { chemist: { territoryId: params.territoryId } } : {}),
      ...(params.subArea ? { chemist: { subArea: { equals: params.subArea, mode: "insensitive" } } } : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
    };

    const pendingOrders = await db.order.findMany({
      where: uninvoicedOrderWhere,
      include: {
        chemist: {
          select: {
            id: true,
            name: true,
            subArea: true,
            territoryId: true,
            territory: { select: { id: true, name: true } },
          },
        },
        doctor: {
          select: {
            id: true,
            fullName: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: {
              select: {
                role: true,
              },
            },
          },
        },
        items: {
          select: {
            price: true,
            quantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // ── 3. Compute Summary Metrics ──
    let totalInvoicedAmount = 0;
    let totalPaidAmount = 0;
    let totalUnpaidAmount = 0;

    for (const inv of allInvoices) {
      const amt = Number(inv.amount || 0);
      totalInvoicedAmount += amt;
      if (inv.paid) {
        totalPaidAmount += amt;
      } else {
        totalUnpaidAmount += amt;
      }
    }

    let totalPendingOrdersAmount = 0;
    const formattedPendingOrders = pendingOrders.map((o) => {
      const amt = o.items.reduce((s, it) => s + Number(it.price || 0) * (it.quantity || 0), 0);
      totalPendingOrdersAmount += amt;
      return {
        id: o.id,
        orderDate: o.createdAt.toISOString(),
        amount: Math.round(amt * 100) / 100,
        chemistName: o.chemist?.name || "Unassigned Chemist",
        doctorName: o.doctor?.fullName || null,
        territoryName: o.chemist?.territory?.name || "General Territory",
        subArea: o.chemist?.subArea || null,
        employeeName: o.employee ? `${o.employee.firstName} ${o.employee.lastName}` : "Central Booking",
        itemsCount: o.items.length,
      };
    });

    // ── 4. Area-Wise Aggregations (Territory & Sub-Area) ──
    const areaMap = new Map<string, AreaInvoiceBreakdown>();

    for (const inv of allInvoices) {
      const tId = inv.order?.chemist?.territoryId || "unassigned-area";
      const tName = inv.order?.chemist?.territory?.name || "General Area";
      const subArea = inv.order?.chemist?.subArea || null;
      const key = `${tId}_${subArea || "main"}`;

      if (!areaMap.has(key)) {
        areaMap.set(key, {
          territoryId: tId,
          territoryName: tName,
          subArea,
          totalInvoiced: 0,
          invoiceCount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          pendingOrdersCount: 0,
          pendingOrdersAmount: 0,
        });
      }

      const row = areaMap.get(key)!;
      const amt = Number(inv.amount || 0);
      row.totalInvoiced += amt;
      row.invoiceCount += 1;
      if (inv.paid) row.paidAmount += amt;
      else row.unpaidAmount += amt;
    }

    // Add pending orders to Area map
    for (const pOrder of pendingOrders) {
      const tId = pOrder.chemist?.territoryId || "unassigned-area";
      const tName = pOrder.chemist?.territory?.name || "General Area";
      const subArea = pOrder.chemist?.subArea || null;
      const key = `${tId}_${subArea || "main"}`;

      if (!areaMap.has(key)) {
        areaMap.set(key, {
          territoryId: tId,
          territoryName: tName,
          subArea,
          totalInvoiced: 0,
          invoiceCount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          pendingOrdersCount: 0,
          pendingOrdersAmount: 0,
        });
      }

      const row = areaMap.get(key)!;
      const amt = pOrder.items.reduce((s, it) => s + Number(it.price || 0) * (it.quantity || 0), 0);
      row.pendingOrdersCount += 1;
      row.pendingOrdersAmount += amt;
    }

    const areaBreakdowns = Array.from(areaMap.values()).sort(
      (a, b) => b.totalInvoiced + b.pendingOrdersAmount - (a.totalInvoiced + a.pendingOrdersAmount)
    );

    // ── 5. Person-Wise Aggregations (Sales Rep / MR) ──
    const personMap = new Map<string, PersonInvoiceBreakdown>();

    for (const inv of allInvoices) {
      const empId = inv.order?.employeeId || "central";
      const empName = inv.order?.employee
        ? `${inv.order.employee.firstName} ${inv.order.employee.lastName}`
        : "Direct / Central Booking";
      const role = inv.order?.employee?.user?.role || "SYSTEM";
      const phone = inv.order?.employee?.phone || null;

      if (!personMap.has(empId)) {
        personMap.set(empId, {
          employeeId: empId,
          employeeName: empName,
          role,
          phone,
          totalInvoiced: 0,
          invoiceCount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          pendingOrdersCount: 0,
          pendingOrdersAmount: 0,
        });
      }

      const row = personMap.get(empId)!;
      const amt = Number(inv.amount || 0);
      row.totalInvoiced += amt;
      row.invoiceCount += 1;
      if (inv.paid) row.paidAmount += amt;
      else row.unpaidAmount += amt;
    }

    for (const pOrder of pendingOrders) {
      const empId = pOrder.employeeId || "central";
      const empName = pOrder.employee
        ? `${pOrder.employee.firstName} ${pOrder.employee.lastName}`
        : "Direct / Central Booking";
      const role = pOrder.employee?.user?.role || "SYSTEM";

      if (!personMap.has(empId)) {
        personMap.set(empId, {
          employeeId: empId,
          employeeName: empName,
          role,
          totalInvoiced: 0,
          invoiceCount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          pendingOrdersCount: 0,
          pendingOrdersAmount: 0,
        });
      }

      const row = personMap.get(empId)!;
      const amt = pOrder.items.reduce((s, it) => s + Number(it.price || 0) * (it.quantity || 0), 0);
      row.pendingOrdersCount += 1;
      row.pendingOrdersAmount += amt;
    }

    const personBreakdowns = Array.from(personMap.values()).sort(
      (a, b) => b.totalInvoiced + b.pendingOrdersAmount - (a.totalInvoiced + a.pendingOrdersAmount)
    );

    // ── 6. Cadence Buckets (Monthly & Quarterly Timeline) ──
    const cadenceMap = new Map<string, CadenceBucketSummary>();

    if (cadence === "DAILY") {
      // Group by single date or last 14 days
      for (const inv of allInvoices) {
        const dStr = inv.createdAt.toISOString().slice(0, 10);
        if (!cadenceMap.has(dStr)) {
          cadenceMap.set(dStr, {
            bucketKey: dStr,
            bucketLabel: new Date(dStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            startDate: `${dStr}T00:00:00.000Z`,
            endDate: `${dStr}T23:59:59.999Z`,
            invoicedAmount: 0,
            invoiceCount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            pendingOrdersCount: 0,
            pendingOrdersAmount: 0,
          });
        }
        const bucket = cadenceMap.get(dStr)!;
        const amt = Number(inv.amount || 0);
        bucket.invoicedAmount += amt;
        bucket.invoiceCount += 1;
        if (inv.paid) bucket.paidAmount += amt;
        else bucket.unpaidAmount += amt;
      }
    } else if (cadence === "QUARTERLY") {
      // Group by Quarter (Q1..Q4)
      for (const inv of allInvoices) {
        const d = new Date(inv.createdAt);
        const qNum = Math.floor(d.getMonth() / 3) + 1;
        const qKey = `${d.getFullYear()}-Q${qNum}`;
        const qLabel = `Q${qNum} ${d.getFullYear()} (Quarterly)`;

        if (!cadenceMap.has(qKey)) {
          cadenceMap.set(qKey, {
            bucketKey: qKey,
            bucketLabel: qLabel,
            startDate: new Date(d.getFullYear(), (qNum - 1) * 3, 1).toISOString(),
            endDate: new Date(d.getFullYear(), qNum * 3, 0, 23, 59, 59).toISOString(),
            invoicedAmount: 0,
            invoiceCount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            pendingOrdersCount: 0,
            pendingOrdersAmount: 0,
          });
        }
        const bucket = cadenceMap.get(qKey)!;
        const amt = Number(inv.amount || 0);
        bucket.invoicedAmount += amt;
        bucket.invoiceCount += 1;
        if (inv.paid) bucket.paidAmount += amt;
        else bucket.unpaidAmount += amt;
      }
    } else {
      // Monthly Grouping
      for (const inv of allInvoices) {
        const d = new Date(inv.createdAt);
        const mKey = inv.createdAt.toISOString().slice(0, 7); // YYYY-MM
        const mLabel = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

        if (!cadenceMap.has(mKey)) {
          cadenceMap.set(mKey, {
            bucketKey: mKey,
            bucketLabel: mLabel,
            startDate: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
            endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
            invoicedAmount: 0,
            invoiceCount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            pendingOrdersCount: 0,
            pendingOrdersAmount: 0,
          });
        }
        const bucket = cadenceMap.get(mKey)!;
        const amt = Number(inv.amount || 0);
        bucket.invoicedAmount += amt;
        bucket.invoiceCount += 1;
        if (inv.paid) bucket.paidAmount += amt;
        else bucket.unpaidAmount += amt;
      }
    }

    const cadenceBreakdowns = Array.from(cadenceMap.values()).sort((a, b) => b.bucketKey.localeCompare(a.bucketKey));

    return {
      summary: {
        totalInvoicedAmount: Math.round(totalInvoicedAmount * 100) / 100,
        totalInvoicesCount: allInvoices.length,
        totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
        totalUnpaidAmount: Math.round(totalUnpaidAmount * 100) / 100,
        totalPendingOrdersCount: pendingOrders.length,
        totalPendingOrdersAmount: Math.round(totalPendingOrdersAmount * 100) / 100,
        cadence,
        filterDate: params.date,
        filterMonth: params.month,
        filterQuarter: params.quarter,
      },
      cadenceBreakdowns,
      areaBreakdowns,
      personBreakdowns,
      uninvoicedOrders: formattedPendingOrders,
    };
  }

  /**
   * One-Click Batch Invoicing Generator:
   * Generates official GST Tax Invoices for un-invoiced orders matching Cadence, Area, or Person.
   */
  public static async generateBatchInvoices(params: {
    cadence?: InvoicingCadence;
    date?: string;
    month?: string;
    quarter?: string;
    territoryId?: string;
    subArea?: string;
    employeeId?: string;
    orderIds?: string[];
  }): Promise<{
    success: boolean;
    generatedCount: number;
    totalAmount: number;
    invoices: Array<{ id: string; invoiceNo: string; amount: number; partyName: string }>;
    message: string;
  }> {
    const dateRange = this.getCadenceDateRange(params);

    const where: Prisma.OrderWhereInput = {
      invoice: null,
      status: { not: OrderStatus.CANCELLED },
      ...(params.orderIds && params.orderIds.length > 0 ? { id: { in: params.orderIds } } : {}),
      ...(dateRange.gte || dateRange.lte ? { createdAt: dateRange } : {}),
      ...(params.territoryId ? { chemist: { territoryId: params.territoryId } } : {}),
      ...(params.subArea ? { chemist: { subArea: { equals: params.subArea, mode: "insensitive" } } } : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
    };

    const eligibleOrders = await db.order.findMany({
      where,
      include: {
        chemist: { include: { territory: true } },
        distributor: true,
        items: { include: { product: true } },
        doctor: true,
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    if (eligibleOrders.length === 0) {
      return {
        success: true,
        generatedCount: 0,
        totalAmount: 0,
        invoices: [],
        message: "No un-invoiced orders found matching the specified cadence or criteria.",
      };
    }

    const generatedInvoices: Array<{ id: string; invoiceNo: string; amount: number; partyName: string }> = [];
    let cumulativeAmount = 0;

    for (const order of eligibleOrders) {
      const chemist = order.chemist;
      const lineItems = order.items.map((it) => {
        const unitPrice = Number(it.price || it.product.ptr || it.product.price);
        const discountPct = Number(it.discountPct || 0);
        const gstPct = Number(it.gstPct || it.product.gstPct || 12);
        return {
          quantity: it.quantity,
          price: unitPrice,
          discountPct,
          gstPct,
        };
      });

      const orderValue = lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0);
      const gstTotals = computeInvoiceTotals(lineItems);

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const invoiceNo = `INV-${order.createdAt.getFullYear()}${String(order.createdAt.getMonth() + 1).padStart(2, "0")}-${order.id.slice(0, 4).toUpperCase()}${randomSuffix}`;

      const createdInvoice = await db.invoice.create({
        data: {
          orderId: order.id,
          invoiceNo,
          amount: orderValue,
          paid: false,
          partyName: chemist?.billingName || chemist?.name || order.doctor?.fullName || "Valued Customer",
          partyGstNo: chemist?.gstNo || null,
          partyAddress: chemist?.address || order.doctor?.clinicAddress || "Registered Territory Address",
          partyDlNo: chemist?.licenseNo || null,
          partyPhone: chemist?.mobile || order.doctor?.mobile || null,
          totalItems: gstTotals.totalItems,
          totalQty: gstTotals.totalQty,
          totalDiscount: gstTotals.totalDiscount,
          totalGst: gstTotals.totalGst,
          roundOff: gstTotals.roundOff,
          grandTotal: gstTotals.grandTotal,
        },
      });

      // Post auto-ledger entries
      try {
        const gstAmount = Number(gstTotals.totalGst ?? 0);
        const grandTotal = Number(gstTotals.grandTotal ?? orderValue);
        const salesAmount = grandTotal - gstAmount;

        await postAutoLedger(db, {
          sourceType: "INVOICE",
          sourceId: createdInvoice.id,
          date: createdInvoice.createdAt,
          narration: `Batch Invoicing — Generated Invoice ${createdInvoice.invoiceNo} for ${createdInvoice.partyName}`,
          lines: [
            { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, debit: grandTotal },
            { accountCode: SYSTEM_ACCOUNT_CODES.salesRevenue, credit: salesAmount },
            ...(gstAmount > 0 ? [{ accountCode: SYSTEM_ACCOUNT_CODES.gstPayable, credit: gstAmount }] : []),
          ],
        });
      } catch (e) {
        console.warn(`[BatchInvoicing] Auto-ledger notice for ${createdInvoice.invoiceNo}:`, e);
      }

      generatedInvoices.push({
        id: createdInvoice.id,
        invoiceNo: createdInvoice.invoiceNo,
        amount: Number(createdInvoice.amount),
        partyName: createdInvoice.partyName || "Customer",
      });

      cumulativeAmount += Number(createdInvoice.amount);
    }

    const scopeDesc = params.cadence
      ? `cadence: ${params.cadence}`
      : params.territoryId
      ? "area-wise"
      : params.employeeId
      ? "person-wise"
      : "selected scope";

    return {
      success: true,
      generatedCount: generatedInvoices.length,
      totalAmount: Math.round(cumulativeAmount * 100) / 100,
      invoices: generatedInvoices,
      message: `Successfully generated ${generatedInvoices.length} invoices totaling ₹${cumulativeAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} across ${scopeDesc}.`,
    };
  }
}
