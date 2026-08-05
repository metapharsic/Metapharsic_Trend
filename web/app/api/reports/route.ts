import { db } from "@/lib/db";
import { Role, ExpenseStatus, OrderStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { startOfUtcMonth } from "@/lib/date";


/**
 * BI Reports library — docs/08_backend/reporting_engine.md §3.
 * Each entry is a named, parameterless report over live data; the catalogue is
 * exposed via GET so the UI can render the list without hardcoding it.
 */
const REPORTS = {
  "product-wise-sales": {
    category: "Sales & Commercial",
    title: "Product-wise Profitability",
    description: "Units, revenue, cost, profit margins, and markup per product SKU.",
    run: async () => {
      const items = await db.orderItem.findMany({
        where: { order: { createdAt: { gte: startOfUtcMonth() } } },
        include: { product: true },
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
        profit: number;
        marginPercent: number;
        markupPercent: number;
      }>();
      for (const item of items) {
        const key = item.product.id;
        const entry = byProduct.get(key) ?? {
          name: item.product.name,
          sku: item.product.sku,
          therapySegment: item.product.therapySegment || "Unassigned",
          packSize: item.product.packSize || "N/A",
          mrp: Number(item.product.mrp || 0),
          ptr: Number(item.product.ptr || 0),
          pts: Number(item.product.pts || 0),
          stockQty: item.product.stockQty,
          units: 0,
          ptsValue: 0,
          ptrValue: 0,
          profit: 0,
          marginPercent: 0,
          markupPercent: 0,
        };
        entry.units += item.quantity;
        entry.ptsValue += Number(item.product.pts || 0) * item.quantity;
        entry.ptrValue += Number(item.product.ptr || 0) * item.quantity;
        
        // Profit to company/stockist based on PTR - PTS
        const diff = Number(item.product.ptr || 0) - Number(item.product.pts || 0);
        entry.profit += diff * item.quantity;

        const ptr = Number(item.product.ptr || 0);
        const pts = Number(item.product.pts || 0);
        entry.marginPercent = ptr > 0 ? Math.round((diff / ptr) * 10000) / 100 : 0;
        entry.markupPercent = pts > 0 ? Math.round((diff / pts) * 10000) / 100 : 0;

        byProduct.set(key, entry);
      }
      return [...byProduct.values()].sort((a, b) => b.ptrValue - a.ptrValue);
    },
  },

  "mr-sales-profit": {
    category: "Sales & Commercial",
    title: "MR Track of Sales & Profit",
    description: "Analysis of sales revenue, gross profits, and expenses logged per MR.",
    run: async () => {
      const employees = await db.employee.findMany({
        where: { user: { role: Role.MR, isActive: true } },
        include: {
          user: { select: { id: true } },
          territories: { select: { name: true } },
          orders: {
            where: { createdAt: { gte: startOfUtcMonth() }, status: OrderStatus.DELIVERED },
            include: {
              items: {
                include: {
                  product: true
                }
              }
            }
          },
          expenses: {
            where: {
              createdAt: { gte: startOfUtcMonth() },
              status: ExpenseStatus.APPROVED
            }
          }
        }
      });

      return employees.map((emp) => {
        let totalSales = 0;
        let totalProfit = 0;
        for (const order of emp.orders) {
          for (const item of order.items) {
            const ptr = Number(item.product.ptr || item.price || 0);
            const pts = Number(item.product.pts || 0);
            totalSales += ptr * item.quantity;
            totalProfit += (ptr - pts) * item.quantity;
          }
        }

        const totalExpenses = emp.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const netProfit = totalProfit - totalExpenses;
        const profitMargin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 10000) / 100 : 0;

        return {
          mrName: `${emp.firstName} ${emp.lastName}`,
          territory: emp.territories[0]?.name || "Unassigned",
          salesValue: totalSales,
          profit: totalProfit,
          expenses: totalExpenses,
          netProfit: netProfit,
          profitMargin: profitMargin
        };
      }).sort((a, b) => b.salesValue - a.salesValue);
    }
  },

  "territory-performance": {
    category: "Sales & Commercial",
    title: "Territory Performance",
    description: "Target versus actual collections per territory.",
    run: async () => {
      const territories = await db.territory.findMany({
        include: { targets: { select: { value: true } } },
      });
      const collections = await db.collection.findMany({
        where: { createdAt: { gte: startOfUtcMonth() } },
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
          zone: t.zone,
          region: t.region,
          target,
          achieved,
          achievementPercent: target > 0 ? Math.round((achieved / target) * 100) : 0,
        };
      });
    },
  },

  "doctor-coverage-index": {
    category: "Activity & Field Force",
    title: "Doctor Coverage Index",
    description: "Percentage of each territory's doctors visited this month.",
    run: async () => {
      const territories = await db.territory.findMany({
        include: { doctors: { select: { id: true } } },
      });
      const visited = await db.visit.findMany({
        where: { createdAt: { gte: startOfUtcMonth() }, doctorId: { not: null } },
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

  "missed-visit-log": {
    category: "Activity & Field Force",
    title: "Missed Visit Log",
    description: "Doctors below their DPS-mandated monthly visit frequency.",
    run: async () => {
      const doctors = await db.doctor.findMany({
        where: { requiredMonthlyVisits: { gt: 0 } },
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
        where: { createdAt: { gte: startOfUtcMonth() }, doctorId: { not: null } },
        _count: { _all: true },
      });
      const countMap = new Map(counts.map((c) => [c.doctorId as string, c._count._all]));
      return doctors
        .map((d) => {
          const actual = countMap.get(d.id) ?? 0;
          return {
            doctor: d.fullName,
            territory: d.territory.name,
            tier: d.dpsTier,
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
    title: "Call Average per MR",
    description: "Visits logged per MR this month, with daily average.",
    run: async () => {
      const monthStart = startOfUtcMonth();
      const daysElapsed = Math.max(
        Math.ceil((Date.now() - monthStart.getTime()) / (24 * 60 * 60 * 1000)),
        1
      );
      const counts = await db.visit.groupBy({
        by: ["employeeId"],
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
      });
      const employees = await db.employee.findMany({
        where: { id: { in: counts.map((c) => c.employeeId) } },
        select: { id: true, firstName: true, lastName: true },
      });
      const nameMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
      return counts
        .map((c) => ({
          mr: nameMap.get(c.employeeId) ?? "Unknown",
          totalCalls: c._count._all,
          dailyAverage: Math.round((c._count._all / daysElapsed) * 100) / 100,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls);
    },
  },

  "expense-claim-summary": {
    category: "Financial & Outstanding",
    title: "Expense Claim Summary",
    description: "Expense totals per employee and category this month.",
    run: async () => {
      const expenses = await db.expense.findMany({
        where: { createdAt: { gte: startOfUtcMonth() } },
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
    title: "Outstanding Approvals",
    description: "Expense claims awaiting action, aged by days pending.",
    run: async () => {
      const pending = await db.expense.findMany({
        where: {
          status: {
            in: [ExpenseStatus.PENDING_ASM, ExpenseStatus.PENDING_RM, ExpenseStatus.PENDING_FINANCE],
          },
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
    title: "GPS Violations",
    description: "Anomalous visits and spoofed-location logs this month.",
    run: async () => {
      const monthStart = startOfUtcMonth();
      const visits = await db.visit.findMany({
        where: { anomalyFlag: true, createdAt: { gte: monthStart } },
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
        details: v.anomalyDetails ? JSON.parse(v.anomalyDetails) : null,
      }));
    },
  },

  "tender-pipeline": {
    category: "Institutional",
    title: "Tender Pipeline",
    description: "Hospital rate-contract tenders by status and contract value.",
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
    title: "Training Compliance",
    description: "LMS course completion rates per employee.",
    run: async () => {
      const enrollments = await db.lMSEnrollment.findMany({
        include: {
          employee: { select: { firstName: true, lastName: true } },
          course: { select: { title: true } },
        },
      });
      const byEmployee = new Map<string, { employee: string; enrolled: number; completed: number }>();
      for (const e of enrollments) {
        const name = `${e.employee.firstName} ${e.employee.lastName}`;
        const entry = byEmployee.get(name) ?? { employee: name, enrolled: 0, completed: 0 };
        entry.enrolled += 1;
        if (e.completed) entry.completed += 1;
        byEmployee.set(name, entry);
      }
      return [...byEmployee.values()].map((r) => ({
        ...r,
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

    const rows = await report.run();
    return ok({ id: key, title: report.title, category: report.category, rows });
  } catch (err) {
    console.error("[GET /api/reports]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to run report", 500);
  }
}

export const GET = withAuth(handleReports, [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM]);
