import { db } from "@/lib/db";
import { Role, ExpenseStatus, OrderStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { startOfUtcMonth, startOfUtcDay, addUtcDays } from "@/lib/date";
import {
  COST_BASIS_SELECT,
  costBasis,
  profitFor,
  round2,
  type CostBasisSource,
} from "@/lib/pricing";

// ADMIN/MD/NSM see company-wide data; ZSM/RM/ASM are scoped to their own
// territories only — mirrors the scoping already enforced on api/mr/dashboard.
const UNSCOPED_ROLES = new Set<Role>([Role.ADMIN, Role.MD, Role.NSM]);

async function getScopeTerritoryIds(req: AuthedRequest): Promise<string[] | null> {
  if (UNSCOPED_ROLES.has(req.user.role as Role)) return null;
  const employee = await db.employee.findUnique({
    where: { userId: req.user.sub },
    include: { territories: { select: { id: true } } },
  });
  return employee ? employee.territories.map((t) => t.id) : [];
}

/**
 * Calculates start and optional end dates for report queries based on timeframe.
 */
function getReportDateRange(timeframe?: string | null, customStart?: string | null, customEnd?: string | null): { startDate: Date; endDate?: Date } {
  const now = new Date();

  if (customStart) {
    const sDate = new Date(customStart);
    const eDate = customEnd ? new Date(customEnd) : undefined;
    return { startDate: isNaN(sDate.getTime()) ? startOfUtcMonth() : sDate, endDate: eDate && !isNaN(eDate.getTime()) ? eDate : undefined };
  }

  switch (timeframe) {
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
      // Indian Financial Year: April 1
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
 * BI Enterprise Reports library — Pharmaceutical standard multi-category intelligence.
 */
const REPORTS = {
  "product-wise-sales": {
    category: "Sales & Commercial",
    title: "Product-wise Profitability & SKU Velocity",
    description: "Units, revenue, cost, profit margins, and markup per product SKU.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const items = await db.orderItem.findMany({
        where: {
          order: {
            createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
            status: OrderStatus.DELIVERED,
            ...(territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : {}),
          },
        },
        select: {
          quantity: true,
          price: true,
          freeQty: true,
          product: {
            select: {
              ...COST_BASIS_SELECT,
              name: true,
              sku: true,
              therapySegment: true,
              packSize: true,
              mrp: true,
              stockQty: true,
            },
          },
        },
      });
      const byProduct = new Map<string, {
        name: string;
        sku: string;
        therapySegment: string;
        packSize: string;
        mrp: number;
        ptr: number;
        pts: number;
        stockQty: number;
        units: number;
        ptsValue: number;
        ptrValue: number;
        revenue: number;
        cost: number;
        profit: number;
        marginPercent: number;
        markupPercent: number;
        costBasisSource: CostBasisSource;
      }>();
      for (const item of items) {
        const key = item.product.id;
        const basis = costBasis(item.product);
        const entry = byProduct.get(key) ?? {
          name: item.product.name,
          sku: item.product.sku,
          therapySegment: item.product.therapySegment || "General",
          packSize: item.product.packSize || "N/A",
          mrp: Number(item.product.mrp || 0),
          ptr: Number(item.product.ptr || 0),
          pts: Number(item.product.pts || 0),
          stockQty: item.product.stockQty,
          units: 0,
          ptsValue: 0,
          ptrValue: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          marginPercent: 0,
          markupPercent: 0,
          costBasisSource: basis.source,
        };
        // Cost and profit come from lib/pricing — this report does not derive
        // its own cost basis (it used to read ptr - pts straight off Product).
        const line = profitFor([item]);
        entry.units += item.quantity;
        entry.ptsValue += Number(item.product.pts || 0) * item.quantity;
        entry.ptrValue += Number(item.product.ptr || 0) * item.quantity;
        entry.revenue = round2(entry.revenue + line.revenue);
        entry.cost = round2(entry.cost + line.cost);
        entry.profit = round2(entry.revenue - entry.cost);
        entry.marginPercent = entry.revenue > 0 ? round2((entry.profit / entry.revenue) * 100) : 0;
        entry.markupPercent = entry.cost > 0 ? round2((entry.profit / entry.cost) * 100) : 0;
        entry.costBasisSource = basis.source;

        byProduct.set(key, entry);
      }
      return [...byProduct.values()].sort((a, b) => b.ptrValue - a.ptrValue);
    },
    summary: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const expenses = await db.expense.aggregate({
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          status: ExpenseStatus.APPROVED,
          ...(territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : {}),
        },
        _sum: { amount: true },
      });
      return { totalExpenses: Number(expenses._sum.amount ?? 0) };
    },
  },

  "mr-sales-profit": {
    category: "Sales & Commercial",
    title: "MR Track of Sales, Revenue & Net Margins",
    description: "Analysis of sales revenue, gross profits, and expenses logged per MR.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const employees = await db.employee.findMany({
        where: {
          user: { role: Role.MR, isActive: true },
          ...(territoryIds ? { territories: { some: { id: { in: territoryIds } } } } : {}),
        },
        include: {
          user: { select: { id: true } },
          territories: { select: { name: true } },
          orders: {
            where: {
              createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
              status: OrderStatus.DELIVERED,
            },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
          expenses: {
            where: {
              createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
              status: ExpenseStatus.APPROVED,
            },
          },
        },
      });

      return employees.map((emp) => {
        // Revenue, cost and profit all come from lib/pricing. This report used
        // to read `ptr - pts` off the Product, which ignored purchaseRate and
        // treated a missing pts as a cost of zero -- i.e. infinite margin.
        const lines = emp.orders.flatMap((order) => order.items);
        const totals = profitFor(lines);
        const totalSales = totals.revenue;
        const totalProfit = totals.profitAmount;
        const usedSources = [...new Set(totals.sources)];
        const costBasisSource: CostBasisSource | "mixed" =
          usedSources.length === 1 ? usedSources[0] : usedSources.length === 0 ? "none" : "mixed";

        const totalExpenses = emp.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const netProfit = round2(totalProfit - totalExpenses);
        const profitMargin = totals.profitPct ?? 0;

        return {
          mrName: `${emp.firstName} ${emp.lastName}`,
          territory: emp.territories[0]?.name || "Unassigned",
          salesValue: totalSales,
          profit: totalProfit,
          expenses: totalExpenses,
          netProfit: netProfit,
          profitMargin: profitMargin,
          costBasisSource,
        };
      }).sort((a, b) => b.salesValue - a.salesValue);
    },
  },

  "territory-performance": {
    category: "Sales & Commercial",
    title: "Territory Performance & Target Attainment",
    description: "Target versus actual collections and primary attainment per territory.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const territories = await db.territory.findMany({
        where: territoryIds ? { id: { in: territoryIds } } : undefined,
        include: { targets: { select: { value: true } } },
      });
      const collections = await db.collection.findMany({
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          ...(territoryIds ? { chemist: { territoryId: { in: territoryIds } } } : {}),
        },
        include: { chemist: { select: { territoryId: true } } },
      });
      const achievedByTerritory = new Map<string, number>();
      for (const c of collections) {
        const tid = c.chemist.territoryId;
        achievedByTerritory.set(tid, (achievedByTerritory.get(tid) ?? 0) + Number(c.amount));
      }
      return territories.map((t) => {
        const target = t.targets.reduce((sum, x) => sum + Number(x.value), 0);
        const achieved = achievedByTerritory.get(t.id) ?? 0;
        return {
          territory: t.name,
          zone: t.zone || "East Zone",
          region: t.region || "Kolkata Region",
          target,
          achieved,
          achievementPercent: target > 0 ? Math.round((achieved / target) * 100) : 0,
        };
      });
    },
  },

  "doctor-coverage-index": {
    category: "Activity & Field Force",
    title: "Doctor Coverage & Call Reach Index",
    description: "Percentage of each territory's doctors visited within the period.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const territories = await db.territory.findMany({
        where: territoryIds ? { id: { in: territoryIds } } : undefined,
        include: { doctors: { select: { id: true } } },
      });
      const visited = await db.visit.findMany({
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          doctorId: { not: null },
          ...(territoryIds ? { doctor: { territoryId: { in: territoryIds } } } : {}),
        },
        distinct: ["doctorId"],
        select: { doctorId: true },
      });
      const visitedSet = new Set(visited.map((v) => v.doctorId));
      return territories.map((t) => {
        const total = t.doctors.length;
        const covered = t.doctors.filter((d) => visitedSet.has(d.id)).length;
        return {
          territory: t.name,
          totalDoctors: total,
          doctorsVisited: covered,
          coveragePercent: total > 0 ? Math.round((covered / total) * 100) : 0,
        };
      });
    },
  },

  "doctor-dps-tiering": {
    category: "Activity & Field Force",
    title: "Doctor DPS & Tiering Distribution",
    description: "Doctors classified by DPS tier (A+, A, B, C), visit frequency compliance, and patient volume.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const doctors = await db.doctor.findMany({
        where: territoryIds ? { territoryId: { in: territoryIds } } : undefined,
        include: {
          territory: { select: { name: true } },
          visits: {
            where: { createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
            select: { id: true },
          },
        },
      });

      return doctors.map((d) => {
        const actualVisits = d.visits.length;
        const requiredVisits = d.requiredMonthlyVisits || 2;
        const adherencePct = requiredVisits > 0 ? Math.min(100, Math.round((actualVisits / requiredVisits) * 100)) : 100;
        return {
          doctor: d.fullName,
          specialty: d.primarySpecialty || "General Medicine",
          tier: d.dpsTier || "B",
          dpsScore: Number(d.dpsScore || 0),
          territory: d.territory?.name || "General",
          patientFootfall: d.patientFootfallDaily || 0,
          avgPrescriptions: d.avgPrescriptionsDaily || 0,
          requiredVisits,
          actualVisits,
          adherencePct,
          isKol: d.isKol ? "KOL" : "Core",
        };
      }).sort((a, b) => b.dpsScore - a.dpsScore);
    },
  },

  "missed-visit-log": {
    category: "Activity & Field Force",
    title: "Missed Visits & Frequency Shortfall",
    description: "Doctors below their DPS-mandated visit frequency.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const doctors = await db.doctor.findMany({
        where: {
          requiredMonthlyVisits: { gt: 0 },
          ...(territoryIds ? { territoryId: { in: territoryIds } } : {}),
        },
        select: {
          id: true,
          fullName: true,
          dpsTier: true,
          requiredMonthlyVisits: true,
          territory: { select: { name: true } },
        },
      });
      const counts = await db.visit.groupBy({
        by: ["doctorId"],
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          doctorId: { not: null },
          ...(territoryIds ? { doctor: { territoryId: { in: territoryIds } } } : {}),
        },
        _count: { _all: true },
      });
      const countMap = new Map(counts.map((c) => [c.doctorId as string, c._count._all]));
      return doctors
        .map((d) => {
          const actual = countMap.get(d.id) ?? 0;
          return {
            doctor: d.fullName,
            territory: d.territory.name,
            tier: d.dpsTier || "B",
            required: d.requiredMonthlyVisits,
            actual,
            shortfall: Math.max(d.requiredMonthlyVisits - actual, 0),
          };
        })
        .filter((r) => r.shortfall > 0)
        .sort((a, b) => b.shortfall - a.shortfall);
    },
  },

  "call-average": {
    category: "Activity & Field Force",
    title: "Call Productivity & Daily Average per MR",
    description: "Visits logged per MR with daily productivity averages.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const daysElapsed = Math.max(
        Math.ceil((Date.now() - dateRange.startDate.getTime()) / (24 * 60 * 60 * 1000)),
        1
      );
      const counts = await db.visit.groupBy({
        by: ["employeeId"],
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          ...(territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : {}),
        },
        _count: { _all: true },
      });
      const employees = await db.employee.findMany({
        where: { id: { in: counts.map((c) => c.employeeId) } },
        select: { id: true, firstName: true, lastName: true },
      });
      const nameMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
      return counts
        .map((c) => ({
          mr: nameMap.get(c.employeeId) ?? "Unknown MR",
          totalCalls: c._count._all,
          dailyAverage: Math.round((c._count._all / daysElapsed) * 100) / 100,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls);
    },
  },

  "tourplan-adherence": {
    category: "Activity & Field Force",
    title: "Tour Plan Compliance & Route Deviations",
    description: "Adherence of field visits against submitted and approved monthly tour plans.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const employees = await db.employee.findMany({
        where: {
          user: { role: Role.MR, isActive: true },
          ...(territoryIds ? { territories: { some: { id: { in: territoryIds } } } } : {}),
        },
        include: {
          territories: { select: { name: true } },
          tourPlans: {
            where: { createdAt: { gte: dateRange.startDate } },
            include: { days: true },
          },
          visits: {
            where: { createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
            select: { id: true },
          },
        },
      });

      return employees.map((emp) => {
        const plannedDaysCount = emp.tourPlans.reduce((sum, tp) => sum + tp.days.length, 0);
        const actualVisitsCount = emp.visits.length;
        const approvalStatus = emp.tourPlans[0]?.status || "PENDING_ASM";
        const complianceScore = plannedDaysCount > 0
          ? Math.min(100, Math.round((actualVisitsCount / (plannedDaysCount * 6)) * 100))
          : 85;

        return {
          mr: `${emp.firstName} ${emp.lastName}`,
          territory: emp.territories[0]?.name || "General",
          plannedDays: plannedDaysCount || 22,
          actualVisits: actualVisitsCount,
          planStatus: approvalStatus,
          adherenceScore: `${complianceScore}%`,
        };
      });
    },
  },

  "sample-gift-audit": {
    category: "Sales & Commercial",
    title: "Sample & Detailing Asset Stock Audit",
    description: "Allocated sample inventory versus doctor distributions and field balances.",
    run: async (territoryIds: string[] | null) => {
      const sampleInventories = await db.sampleInventory.findMany({
        where: territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : undefined,
        include: {
          product: { select: { name: true, sku: true, ptr: true } },
          employee: { select: { firstName: true, lastName: true } },
        },
      });

      const samplesGiven = await db.sample.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
      });
      const givenMap = new Map(samplesGiven.map((sg) => [sg.productId, sg._sum.quantity || 0]));

      return sampleInventories.map((si) => {
        const distributed = givenMap.get(si.productId) || 0;
        const stockValue = Number(si.product?.ptr || 0) * si.quantity;
        return {
          product: si.product.name,
          sku: si.product.sku,
          mr: `${si.employee.firstName} ${si.employee.lastName}`,
          allocatedQty: si.allocatedQty || si.quantity + distributed,
          distributedQty: distributed,
          balanceStock: si.quantity,
          stockValue: `₹${stockValue.toLocaleString("en-IN")}`,
          status: si.quantity < 5 ? "LOW_STOCK" : "ADEQUATE",
        };
      });
    },
  },

  "chemist-aging-analysis": {
    category: "Financial & Outstanding",
    title: "Chemist Outstanding & Aging Analysis",
    description: "Chemist credit limits, payment collections, outstanding balances, and credit risk tiers.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const chemists = await db.chemist.findMany({
        where: territoryIds ? { territoryId: { in: territoryIds } } : undefined,
        include: {
          territory: { select: { name: true } },
          orders: {
            where: { createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
            include: { items: { select: { price: true, quantity: true } } },
          },
          collections: {
            where: { createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) } },
            select: { amount: true },
          },
        },
      });

      return chemists.map((c) => {
        const totalBilled = c.orders.reduce((sum, o) => {
          const orderSum = o.items.reduce((iSum, it) => iSum + Number(it.price) * it.quantity, 0);
          return sum + orderSum;
        }, 0);
        const totalCollected = c.collections.reduce((sum, col) => sum + Number(col.amount || 0), 0);
        const outstanding = Math.max(0, totalBilled - totalCollected);
        const creditLimit = Number(c.creditLimit || 50000);
        const utilizationPct = creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : 0;
        const riskCategory = utilizationPct > 80 ? "HIGH_RISK" : utilizationPct > 50 ? "MEDIUM_RISK" : "HEALTHY";

        return {
          chemist: c.name,
          contactPerson: c.contactPerson || "Proprietor",
          territory: c.territory?.name || "General",
          creditLimit,
          totalBilled,
          totalCollected,
          outstanding,
          utilizationPct: `${utilizationPct}%`,
          riskCategory,
        };
      }).sort((a, b) => b.outstanding - a.outstanding);
    },
  },

  "gst-tax-summary": {
    category: "Financial & Outstanding",
    title: "GST & Statutory Invoicing Summary",
    description: "Taxable invoice amounts, CGST, SGST, IGST, and round-off breakdowns.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const invoices = await db.invoice.findMany({
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          ...(territoryIds ? { order: { employee: { territories: { some: { id: { in: territoryIds } } } } } } : {}),
        },
        include: {
          order: {
            select: {
              id: true,
              chemist: { select: { name: true, gstNo: true } },
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return invoices.map((inv) => {
        const grossAmount = Number(inv.amount || 0);
        const totalGst = Number(inv.totalGst || 0);
        const taxableAmount = Math.max(0, grossAmount - totalGst);
        const cgst = Math.round((totalGst / 2) * 100) / 100;
        const sgst = Math.round((totalGst / 2) * 100) / 100;

        return {
          invoiceNo: inv.invoiceNo,
          orderNo: inv.orderId.slice(0, 8).toUpperCase(),
          partyName: inv.partyName || inv.order?.chemist?.name || "Retail Partner",
          gstin: inv.partyGstNo || inv.order?.chemist?.gstNo || "Unregistered",
          taxableValue: taxableAmount,
          cgstAmount: cgst,
          sgstAmount: sgst,
          totalGst: totalGst,
          roundOff: Number(inv.roundOff || 0),
          grandTotal: Number(inv.grandTotal || inv.amount),
          status: inv.paid ? "PAID" : "OUTSTANDING",
        };
      });
    },
  },

  "expense-claim-summary": {
    category: "Financial & Outstanding",
    title: "Expense Claim Summary & Category Allocation",
    description: "Expense totals per employee and category within the specified timeframe.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const expenses = await db.expense.findMany({
        where: {
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          ...(territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : {}),
        },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });
      const rows = new Map<string, { employee: string; category: string; total: number; claims: number }>();
      for (const e of expenses) {
        const employeeName = `${e.employee.firstName} ${e.employee.lastName}`;
        const key = `${employeeName}|${e.category}`;
        const entry = rows.get(key) ?? { employee: employeeName, category: e.category, total: 0, claims: 0 };
        entry.total += Number(e.amount);
        entry.claims += 1;
        rows.set(key, entry);
      }
      return [...rows.values()].sort((a, b) => b.total - a.total);
    },
  },

  "outstanding-approvals": {
    category: "Financial & Outstanding",
    title: "Outstanding Multi-Tier Approvals Aging",
    description: "Expense claims and tour plans awaiting management action, aged by days pending.",
    run: async (territoryIds: string[] | null) => {
      const pending = await db.expense.findMany({
        where: {
          status: {
            in: [ExpenseStatus.PENDING_ASM, ExpenseStatus.PENDING_RM, ExpenseStatus.PENDING_FINANCE],
          },
          ...(territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : {}),
        },
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      });
      return pending.map((e) => ({
        employee: `${e.employee.firstName} ${e.employee.lastName}`,
        category: e.category,
        amount: Number(e.amount),
        status: e.status,
        daysPending: Math.floor((Date.now() - e.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
      }));
    },
  },

  "gps-violations": {
    category: "Compliance & Audit",
    title: "GPS Geofencing & Location Compliance Audit",
    description: "Anomalous visits, distance outliers, and spoofed-location logs.",
    run: async (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => {
      const visits = await db.visit.findMany({
        where: {
          anomalyFlag: true,
          createdAt: { gte: dateRange.startDate, ...(dateRange.endDate ? { lt: dateRange.endDate } : {}) },
          ...(territoryIds ? { doctor: { territoryId: { in: territoryIds } } } : {}),
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
          doctor: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return visits.map((v) => ({
        mr: `${v.employee.firstName} ${v.employee.lastName}`,
        entity: v.doctor?.fullName ?? "Chemist visit",
        loggedAt: v.createdAt,
        details: (() => {
          if (!v.anomalyDetails) return "Distance beyond geofence threshold";
          try {
            return JSON.parse(v.anomalyDetails);
          } catch {
            return v.anomalyDetails;
          }
        })(),
      }));
    },
  },

  "tender-pipeline": {
    category: "Institutional",
    title: "Hospital Rate-Contract & Institutional Pipeline",
    description: "Hospital rate-contract tenders by status, quantity, and total contract value.",
    run: async () => {
      const tenders = await db.hospitalTender.findMany({
        include: {
          hospital: { select: { name: true } },
          product: { select: { name: true, sku: true } },
        },
        orderBy: { validTo: "desc" },
      });
      return tenders.map((t) => ({
        tenderNo: t.tenderNo,
        hospital: t.hospital.name,
        product: t.product.name,
        status: t.status,
        contractRate: Number(t.contractRate),
        quantity: t.quantity,
        contractValue: Number(t.contractRate) * t.quantity,
        validTo: t.validTo,
      }));
    },
  },

  "training-compliance": {
    category: "HRMS",
    title: "LMS Training Compliance & Certification Scorecard",
    description: "Employee curriculum progress, quiz assessments, and completion rates.",
    run: async (territoryIds: string[] | null) => {
      const enrollments = await db.lMSEnrollment.findMany({
        where: territoryIds ? { employee: { territories: { some: { id: { in: territoryIds } } } } } : undefined,
        include: {
          employee: { select: { firstName: true, lastName: true } },
          course: { select: { title: true } },
        },
      });
      const byEmployee = new Map<string, { employee: string; enrolled: number; completed: number; avgQuizScore: number }>();
      for (const e of enrollments) {
        const name = `${e.employee.firstName} ${e.employee.lastName}`;
        const entry = byEmployee.get(name) ?? { employee: name, enrolled: 0, completed: 0, avgQuizScore: 0 };
        entry.enrolled += 1;
        if (e.completed) entry.completed += 1;
        if (e.quizScore) entry.avgQuizScore = Math.max(entry.avgQuizScore, e.quizScore);
        byEmployee.set(name, entry);
      }
      return [...byEmployee.values()].map((r) => ({
        employee: r.employee,
        enrolled: r.enrolled,
        completed: r.completed,
        quizScore: `${r.avgQuizScore || 85}%`,
        completionPercent: r.enrolled > 0 ? Math.round((r.completed / r.enrolled) * 100) : 0,
      }));
    },
  },
} as const;

type ReportKey = keyof typeof REPORTS;

async function handleReports(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("report") as ReportKey | null;
    const timeframe = searchParams.get("timeframe");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!key) {
      return ok({
        reports: Object.entries(REPORTS).map(([id, r]) => ({
          id,
          category: r.category,
          title: r.title,
          description: r.description,
        })),
      });
    }

    const report = REPORTS[key];
    if (!report) return badRequest(`Unknown report '${key}'`);

    const territoryIds = await getScopeTerritoryIds(req);
    const dateRange = getReportDateRange(timeframe, startDateParam, endDateParam);

    const run = report.run as (territoryIds: string[] | null, dateRange: { startDate: Date; endDate?: Date }) => Promise<any[]>;
    const rows = await run(territoryIds, dateRange);
    const summary = "summary" in report ? await (report as any).summary(territoryIds, dateRange) : undefined;

    return ok({
      id: key,
      title: report.title,
      category: report.category,
      timeframe: timeframe || "this_month",
      dateRange: {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate ? dateRange.endDate.toISOString() : undefined,
      },
      rows,
      summary,
    });
  } catch (err) {
    console.error("[GET /api/reports]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to run report", 500);
  }
}

export const GET = withAuth(handleReports, [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM]);
