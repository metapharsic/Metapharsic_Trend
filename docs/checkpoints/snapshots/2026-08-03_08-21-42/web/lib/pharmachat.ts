import { PrismaClient } from "@prisma/client";
import { startOfUtcMonth } from "./date";

const db = new PrismaClient();

/**
 * PharmaChat query tools — the "MCP database tooling" layer from
 * docs/12_mcp/ai_engine.md. These are plain, typed, read-only functions over the
 * business data; an LLM calls them to answer natural-language coverage questions.
 *
 * The tool layer is deliberately independent of any model provider so it stays
 * useful (and testable) whether or not an LLM is wired up.
 */

export interface PharmaChatTool {
  name: string;
  description: string;
  parameters: Record<string, string>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

export const PHARMACHAT_TOOLS: PharmaChatTool[] = [
  {
    name: "get_territory_coverage",
    description:
      "Coverage for a territory this month: how many of its doctors have been visited at least once.",
    parameters: { territoryName: "string — full or partial territory name" },
    run: async (args) => {
      const territoryName = String(args.territoryName ?? "");
      const territory = await db.territory.findFirst({
        where: { name: { contains: territoryName, mode: "insensitive" } },
        include: { doctors: { select: { id: true } } },
      });
      if (!territory) return { found: false, territoryName };

      const doctorIds = territory.doctors.map((d) => d.id);
      const visited = await db.visit.findMany({
        where: { doctorId: { in: doctorIds }, createdAt: { gte: startOfUtcMonth() } },
        distinct: ["doctorId"],
        select: { doctorId: true },
      });

      return {
        found: true,
        territory: territory.name,
        totalDoctors: doctorIds.length,
        doctorsVisited: visited.length,
        coveragePercent:
          doctorIds.length === 0 ? 0 : Math.round((visited.length / doctorIds.length) * 100),
      };
    },
  },
  {
    name: "get_top_doctors_by_potential",
    description: "Highest-DPS doctors, optionally filtered to a tier (A+, A, B, C).",
    parameters: { tier: "string (optional)", limit: "number (optional, default 10)" },
    run: async (args) => {
      const tier = args.tier ? String(args.tier) : undefined;
      const limit = Number(args.limit ?? 10);
      return db.doctor.findMany({
        where: { ...(tier ? { dpsTier: tier } : {}) },
        select: {
          fullName: true,
          primarySpecialty: true,
          dpsScore: true,
          dpsTier: true,
          requiredMonthlyVisits: true,
        },
        orderBy: { dpsScore: "desc" },
        take: Number.isFinite(limit) ? limit : 10,
      });
    },
  },
  {
    name: "get_mr_performance",
    description: "Visit counts per MR for the current month, ranked highest first.",
    parameters: {},
    run: async () => {
      const counts = await db.visit.groupBy({
        by: ["employeeId"],
        where: { createdAt: { gte: startOfUtcMonth() } },
        _count: { _all: true },
      });
      const employees = await db.employee.findMany({
        where: { id: { in: counts.map((c) => c.employeeId) } },
        select: { id: true, firstName: true, lastName: true },
      });
      const nameMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
      return counts
        .map((c) => ({ name: nameMap.get(c.employeeId) ?? "Unknown", visits: c._count._all }))
        .sort((a, b) => b.visits - a.visits);
    },
  },
  {
    name: "get_uncovered_doctors",
    description:
      "Doctors not visited at all this month, ordered by potential — the coverage gap list.",
    parameters: { limit: "number (optional, default 20)" },
    run: async (args) => {
      const limit = Number(args.limit ?? 20);
      const visited = await db.visit.findMany({
        where: { createdAt: { gte: startOfUtcMonth() }, doctorId: { not: null } },
        distinct: ["doctorId"],
        select: { doctorId: true },
      });
      return db.doctor.findMany({
        where: { id: { notIn: visited.map((v) => v.doctorId as string) } },
        select: {
          fullName: true,
          primarySpecialty: true,
          dpsScore: true,
          dpsTier: true,
          territory: { select: { name: true } },
        },
        orderBy: { dpsScore: "desc" },
        take: Number.isFinite(limit) ? limit : 20,
      });
    },
  },
  {
    name: "get_sales_summary",
    description: "Order count, sales value, and collections for the current month.",
    parameters: {},
    run: async () => {
      const monthStart = startOfUtcMonth();
      const [orderCount, items, collections] = await Promise.all([
        db.order.count({ where: { createdAt: { gte: monthStart } } }),
        db.orderItem.findMany({
          where: { order: { createdAt: { gte: monthStart } } },
          select: { price: true, quantity: true },
        }),
        db.collection.aggregate({
          where: { createdAt: { gte: monthStart } },
          _sum: { amount: true },
        }),
      ]);
      return {
        orders: orderCount,
        salesValue: items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
        collections: Number(collections._sum.amount ?? 0),
      };
    },
  },
];

export function isPharmaChatConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function describeTools() {
  return PHARMACHAT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = PHARMACHAT_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown PharmaChat tool: ${name}`);
  return tool.run(args);
}
