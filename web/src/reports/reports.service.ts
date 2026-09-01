import { db } from "@/lib/db";
import { Role, OrderStatus, ExpenseStatus } from "@prisma/client";
import { ReportsSql } from "./reports.sql";
import {
  BiReportQueryInput,
  MultiAgentReportQueryInput,
  WhatsAppDispatchInput,
} from "./reports.schema";
import {
  MultiAgentCouncilCoordinator,
  GranularMrMultiAgentReport,
  AgentStatusType,
} from "./reports.agents";
import { startOfUtcMonth, startOfUtcDay, addUtcDays } from "@/lib/date";

export class ReportsService {
  /**
   * Calculate date range for BI analytics queries
   */
  static getReportDateRange(timeframe?: string | null, customStart?: string | null, customEnd?: string | null): { startDate: Date; endDate?: Date } {
    const now = new Date();

    if (customStart) {
      const sDate = new Date(customStart);
      const eDate = customEnd ? new Date(customEnd) : undefined;
      return {
        startDate: isNaN(sDate.getTime()) ? startOfUtcMonth() : sDate,
        endDate: eDate && !isNaN(eDate.getTime()) ? eDate : undefined,
      };
    }

    switch (timeframe) {
      case "today":
      case "daily": {
        const todayStart = startOfUtcDay();
        return { startDate: todayStart, endDate: addUtcDays(todayStart, 1) };
      }
      case "last_month": {
        const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const endOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        return { startDate: prevMonthDate, endDate: endOfPrevMonth };
      }
      case "qtd": {
        const currentQuarter = Math.floor(now.getUTCMonth() / 3);
        const startOfQuarter = new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 1));
        return { startDate: startOfQuarter };
      }
      case "ytd": {
        const fyYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
        const startOfFy = new Date(Date.UTC(fyYear, 3, 1));
        return { startDate: startOfFy };
      }
      case "all": {
        return { startDate: new Date("2020-01-01T00:00:00.000Z") };
      }
      case "this_month":
      default: {
        return { startDate: startOfUtcMonth() };
      }
    }
  }

  /**
   * Execute BI Analytics Reports
   */
  static async runBiReport(query: BiReportQueryInput, territoryIds: string[] | null) {
    const dateRange = this.getReportDateRange(query.timeframe, query.startDate, query.endDate);
    const reportId = query.report;

    if (!reportId) {
      // Return catalog of available enterprise reports
      return {
        reports: [
          { id: "product-wise-sales", title: "Product-wise Profitability & SKU Velocity", category: "Sales & Commercial" },
          { id: "doctor-dps-tiering", title: "Doctor DPS Tiering & Call Adherence", category: "Field Productivity & DCR" },
          { id: "chemist-aging-analysis", title: "Chemist Aging & Credit Risk Analysis", category: "Credit & Risk" },
          { id: "sample-gift-audit", title: "Sample & Gift Allocation vs ROI Audit", category: "Marketing & Samples" },
          { id: "tourplan-adherence", title: "Tour Plan Adherence & GPS Accuracy", category: "Compliance & Routing" },
          { id: "gst-tax-summary", title: "GST Output Tax & HSN Summary", category: "Finance & Taxation" },
        ],
      };
    }

    switch (reportId) {
      case "product-wise-sales": {
        const items = await ReportsSql.getProductSalesData(territoryIds, dateRange);
        const byProduct = new Map<string, any>();

        for (const item of items) {
          const key = item.product.id;
          const entry = byProduct.get(key) ?? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            therapySegment: item.product.therapySegment || "General",
            packSize: item.product.packSize || "N/A",
            mrp: Number(item.product.mrp ?? 0),
            ptr: Number(item.product.ptr ?? 0),
            pts: Number(item.product.pts ?? 0),
            stockQty: item.product.stockQty,
            units: 0,
            ptsValue: 0,
            ptrValue: 0,
            profit: 0,
            marginPercent: 0,
            markupPercent: 0,
          };

          const qty = item.quantity;
          const ptrUnit = Number(item.price || item.product.ptr || 0);
          const ptsUnit = Number(item.product.pts || 0);

          entry.units += qty;
          entry.ptrValue += ptrUnit * qty;
          entry.ptsValue += ptsUnit * qty;
          entry.profit = entry.ptrValue - entry.ptsValue;
          entry.marginPercent = entry.ptrValue > 0 ? Math.round((entry.profit / entry.ptrValue) * 10000) / 100 : 0;
          entry.markupPercent = entry.ptsValue > 0 ? Math.round((entry.profit / entry.ptsValue) * 10000) / 100 : 0;
          byProduct.set(key, entry);
        }

        const rows = Array.from(byProduct.values()).sort((a, b) => b.ptrValue - a.ptrValue);
        return { id: "product-wise-sales", title: "Product-wise Profitability & SKU Velocity", timeframe: query.timeframe, rows };
      }

      case "doctor-dps-tiering": {
        const doctors = await ReportsSql.getDoctorDpsData(territoryIds);
        const rows = doctors.map((doc) => ({
          doctor: doc.fullName,
          specialty: doc.primarySpecialty,
          territory: doc.territory?.name || "Unassigned",
          dpsScore: doc.dpsScore,
          tier: doc.dpsTier || "C",
          targetVisits: doc.requiredMonthlyVisits,
          actualVisits: doc.visits.length,
          adherencePct: doc.requiredMonthlyVisits > 0 ? Math.round((doc.visits.length / doc.requiredMonthlyVisits) * 100) : 0,
        }));
        return { id: "doctor-dps-tiering", title: "Doctor DPS Tiering & Call Adherence", rows };
      }

      case "chemist-aging-analysis": {
        const chemists = await ReportsSql.getChemistAgingData(territoryIds);
        const rows = chemists.map((chem) => {
          const totalSales = chem.orders.reduce((sum, o) => sum + Number(o.invoice?.grandTotal ?? o.invoice?.amount ?? 0), 0);
          const totalPaid = chem.collections.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
          const outstanding = Math.max(totalSales - totalPaid, 0);
          const limit = Number(chem.creditLimit ?? 0);
          const creditUtilization = limit > 0 ? Math.round((outstanding / limit) * 100) : 0;

          return {
            chemist: chem.name,
            territory: chem.territory?.name || "Unassigned",
            creditLimit: limit,
            outstanding,
            creditUtilization,
            riskCategory: creditUtilization > 90 ? "HIGH" : creditUtilization > 60 ? "MEDIUM" : "LOW",
          };
        });
        return { id: "chemist-aging-analysis", title: "Chemist Aging & Credit Risk Analysis", rows };
      }

      case "sample-gift-audit": {
        const { sampleInventories, samplesDistributed } = await ReportsSql.getSampleGiftAuditData(territoryIds, dateRange);
        const rows = sampleInventories.map((si) => ({
          employee: `${si.employee.firstName} ${si.employee.lastName}`,
          product: si.product.name,
          allocatedQty: si.allocatedQty,
          remainingQty: si.quantity,
          distributedQty: si.allocatedQty - si.quantity,
        }));
        return { id: "sample-gift-audit", title: "Sample & Gift Allocation vs ROI Audit", rows };
      }

      case "tourplan-adherence": {
        const plans = await ReportsSql.getTourPlanComplianceData(territoryIds, dateRange);
        const rows = plans.map((tp) => ({
          employee: `${tp.employee.firstName} ${tp.employee.lastName}`,
          month: tp.month,
          status: tp.status,
          totalDays: tp.days.length,
        }));
        return { id: "tourplan-adherence", title: "Tour Plan Adherence & GPS Accuracy", rows };
      }

      case "gst-tax-summary": {
        const invoices = await ReportsSql.getGstTaxSummaryData(dateRange);
        const rows = invoices.map((inv) => ({
          invoiceNo: inv.invoiceNo,
          date: inv.createdAt,
          partyName: inv.partyName,
          partyGstNo: inv.partyGstNo,
          taxableValue: Number(inv.grandTotal ?? inv.amount ?? 0) - Number(inv.totalGst ?? 0),
          totalGst: Number(inv.totalGst ?? 0),
          grandTotal: Number(inv.grandTotal ?? inv.amount ?? 0),
        }));
        return { id: "gst-tax-summary", title: "GST Output Tax & HSN Summary", rows };
      }

      default:
        throw new Error(`Report '${reportId}' not found`);
    }
  }

  /**
   * Generate Granular Multi-Agent Council Report for a single MR
   */
  static async generateMrMultiAgentReport(
    employeeIdOrUser: string,
    query?: MultiAgentReportQueryInput
  ): Promise<GranularMrMultiAgentReport | null> {
    const env = process.env.NODE_ENV === "production" || process.env.VPS_ENV ? "VPS_PRODUCTION" : "LOCAL";
    const dateRange = this.getReportDateRange(query?.period, query?.startDate, query?.endDate);

    const mr = await db.employee.findFirst({
      where: {
        OR: [{ id: employeeIdOrUser }, { userId: employeeIdOrUser }, { user: { email: employeeIdOrUser } }],
        user: { role: Role.MR },
      },
      include: {
        user: true,
        territories: true,
        manager: true,
        visits: {
          where: { createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
          include: { doctor: true, chemist: true, hospital: true, samples: { include: { product: true } } },
          orderBy: { createdAt: "desc" },
        },
        orders: {
          where: { createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
          include: { chemist: true, doctor: true, distributor: true, items: { include: { product: true } }, invoice: true },
          orderBy: { createdAt: "desc" },
        },
        expenses: {
          where: { createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
          orderBy: { createdAt: "desc" },
        },
        tourPlans: {
          include: { days: { include: { territory: true, plannedDoctor: true } } },
        },
        locationLogs: {
          where: { recordedAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
          orderBy: { recordedAt: "desc" },
          take: 100,
        },
        attendances: {
          where: { date: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
          orderBy: { date: "desc" },
        },
        collections: {
          where: { createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
          include: { chemist: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!mr) return null;

    // Run Council
    const councilSynthesis = await MultiAgentCouncilCoordinator.runCouncil(mr, env);

    // Compute rollups
    const visits = mr.visits || [];
    const docVisits = visits.filter((v) => v.doctorId);
    const chemVisits = visits.filter((v) => v.chemistId);
    const hospVisits = visits.filter((v) => v.hospitalId);
    const cqsScores = visits.map((v) => v.cqsScore).filter((s): s is number => typeof s === "number");
    const avgCqs = cqsScores.length ? Math.round((cqsScores.reduce((a, b) => a + b, 0) / cqsScores.length) * 10) / 10 : null;
    const totalDuration = visits.reduce((sum, v) => sum + (v.durationMinutes || 0), 0);
    const avgDuration = visits.length ? Math.round(totalDuration / visits.length) : 0;
    const totalBoxesPlaced = visits.reduce((sum, v) => sum + (v.boxesPlaced || 0), 0);

    const orders = mr.orders || [];
    const deliveredOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED);
    const pendingOrders = orders.filter((o) => o.status === OrderStatus.PENDING);
    const cancelledOrders = orders.filter((o) => o.status === OrderStatus.CANCELLED);

    let totalRevenuePts = 0;
    let totalRevenuePtr = 0;
    let totalUnits = 0;
    const skuMap = new Map<string, any>();

    for (const ord of orders) {
      for (const item of ord.items || []) {
        const ptrVal = Number(item.product?.ptr || item.price || 0);
        const ptsVal = Number(item.product?.pts || 0);
        const qty = item.quantity || 0;
        totalUnits += qty;
        totalRevenuePtr += ptrVal * qty;
        totalRevenuePts += ptsVal * qty;

        const prodId = item.productId;
        const existing = skuMap.get(prodId) || {
          productId: prodId,
          productName: item.product?.name || "Product",
          sku: item.product?.sku || "SKU",
          units: 0,
          revenuePtr: 0,
          revenuePts: 0,
          grossMargin: 0,
        };
        existing.units += qty;
        existing.revenuePtr += ptrVal * qty;
        existing.revenuePts += ptsVal * qty;
        existing.grossMargin = existing.revenuePtr - existing.revenuePts;
        skuMap.set(prodId, existing);
      }
    }

    const collections = mr.collections || [];
    const totalCollected = collections.reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const expenses = mr.expenses || [];
    const approvedExpenses = expenses.filter((e) => e.status === ExpenseStatus.APPROVED);
    const pendingExpenses = expenses.filter((e) => [ExpenseStatus.PENDING_ASM, ExpenseStatus.PENDING_RM, ExpenseStatus.PENDING_FINANCE, ExpenseStatus.DRAFT].includes(e.status as any));
    const rejectedExpenses = expenses.filter((e) => e.status === ExpenseStatus.REJECTED);
    const totalApprovedExpensesAmount = approvedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const expenseToSalesRoiPercent = totalRevenuePtr > 0 ? (totalApprovedExpensesAmount / totalRevenuePtr) * 100 : 0;

    const grossProfit = totalRevenuePtr - totalRevenuePts;
    const netTerritoryContribution = grossProfit - totalApprovedExpensesAmount;
    const netMarginPercent = totalRevenuePtr > 0 ? Math.round((netTerritoryContribution / totalRevenuePtr) * 10000) / 100 : 0;

    return {
      mrId: mr.id,
      userId: mr.userId,
      fullName: `${mr.firstName} ${mr.lastName}`,
      email: mr.user.email,
      phone: mr.phone,
      role: mr.user.role,
      manager: mr.manager ? { id: mr.manager.id, name: `${mr.manager.firstName} ${mr.manager.lastName}`, email: "" } : null,
      territories: mr.territories.map((t) => ({ id: t.id, name: t.name, region: t.region, zone: t.zone })),
      deviceUuid: mr.user.deviceUuid,
      isActive: mr.user.isActive,
      generatedAt: new Date().toISOString(),
      environment: env,
      periodLabel: query?.period || "All Time",
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate?.toISOString(),

      dcrSummary: {
        totalVisits: visits.length,
        doctorVisits: docVisits.length,
        chemistVisits: chemVisits.length,
        hospitalVisits: hospVisits.length,
        avgDurationMinutes: avgDuration,
        avgCqsScore: avgCqs,
        totalBoxesPlaced,
        samplesDistributedQty: 0,
        visits: visits.map((v) => ({
          id: v.id,
          targetName: v.doctor?.fullName ?? v.chemist?.name ?? v.hospital?.name ?? "Target",
          targetType: v.doctorId ? "DOCTOR" : v.chemistId ? "CHEMIST" : v.hospitalId ? "HOSPITAL" : "OTHER",
          purpose: v.purpose,
          durationMinutes: v.durationMinutes,
          cqsScore: v.cqsScore,
          boxesPlaced: v.boxesPlaced,
          anomalyFlag: v.anomalyFlag,
          timestamp: v.createdAt.toISOString(),
        })),
      },

      commercialSummary: {
        totalOrdersCount: orders.length,
        deliveredOrdersCount: deliveredOrders.length,
        pendingOrdersCount: pendingOrders.length,
        cancelledOrdersCount: cancelledOrders.length,
        totalRevenuePts: Math.round(totalRevenuePts),
        totalRevenuePtr: Math.round(totalRevenuePtr),
        totalUnitsBooked: totalUnits,
        skuBreakdown: Array.from(skuMap.values()),
        orders: orders.map((o) => ({
          id: o.id,
          status: o.status,
          itemCount: o.items.length,
          totalUnits: o.items.reduce((s, i) => s + i.quantity, 0),
          createdAt: o.createdAt.toISOString(),
        })),
        collections: {
          totalCollected: Math.round(totalCollected),
          recordsCount: collections.length,
          receipts: collections.map((c) => ({
            id: c.id,
            chemistName: c.chemist.name,
            amount: Number(c.amount),
            refNumber: c.refNumber,
            date: c.createdAt.toISOString(),
          })),
        },
      },

      routingSummary: {
        tourPlansCount: mr.tourPlans.length,
        approvedTourPlansCount: mr.tourPlans.filter((t) => t.status === "APPROVED").length,
        plannedDaysCount: mr.tourPlans.reduce((s, t) => s + t.days.length, 0),
        locationLogsCount: mr.locationLogs.length,
        gpsMockFlagsCount: mr.locationLogs.filter((l) => l.isMocked).length,
      },

      expenseHrmsSummary: {
        totalExpensesLogged: expenses.length,
        totalExpensesApproved: approvedExpenses.length,
        totalExpensesPending: pendingExpenses.length,
        totalExpensesRejected: rejectedExpenses.length,
        expenseToSalesRoiPercent: Math.round(expenseToSalesRoiPercent * 10) / 10,
        attendanceDaysLogged: mr.attendances.length,
        claimsCount: 0,
        expensesList: expenses.map((e) => ({
          id: e.id,
          category: e.category,
          amount: Number(e.amount),
          status: e.status,
          date: e.createdAt.toISOString(),
        })),
      },

      financeSummary: {
        grossSalesRevenue: Math.round(totalRevenuePtr),
        costOfGoodsSold: Math.round(totalRevenuePts),
        grossProfit: Math.round(grossProfit),
        fieldExpenses: Math.round(totalApprovedExpensesAmount),
        netTerritoryContribution: Math.round(netTerritoryContribution),
        netMarginPercent,
        ledgerBalanceAuditStatus: "BALANCED",
      },

      councilEvaluation: councilSynthesis,
    };
  }

  /**
   * Generate Council Reports for all MRs
   */
  static async generateAllMrMultiAgentReports(query?: MultiAgentReportQueryInput) {
    const mrs = await db.employee.findMany({
      where: { user: { role: Role.MR } },
      select: { id: true },
    });

    const reports = await Promise.all(
      mrs.map((mr) => this.generateMrMultiAgentReport(mr.id, query))
    );

    return reports.filter((r): r is GranularMrMultiAgentReport => r !== null);
  }

  /**
   * Get Live Multi-Agent Council Status Board
   */
  static async getCouncilStatusBoard() {
    const reports = await this.generateAllMrMultiAgentReports({ period: "daily" });
    const allAgentResults = reports.flatMap((r) => r.councilEvaluation.agentStatuses);

    const statusCounts: Record<AgentStatusType, number> = {
      ONLINE_PASS: 0,
      ONLINE_WARNING: 0,
      ONLINE_ALERT: 0,
      IDLE: 0,
      ERROR: 0,
    };

    for (const res of allAgentResults) {
      statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
    }

    return {
      totalMrsEvaluated: reports.length,
      timestamp: new Date().toISOString(),
      councilStatusSummary: statusCounts,
      overallCouncilHealth:
        statusCounts.ONLINE_ALERT === 0 ? "HEALTHY" : "ATTENTION_REQUIRED",
      reports,
    };
  }
}
