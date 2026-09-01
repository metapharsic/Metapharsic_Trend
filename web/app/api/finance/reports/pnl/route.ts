import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";

async function getPnl(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    if (!fromParam || !toParam) return badRequest("Query params 'from' and 'to' are required (YYYY-MM-DD)");

    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return badRequest("Invalid 'from'/'to' date");

    const accounts = await db.chartOfAccount.findMany({
      where: { isActive: true, type: { in: ["INCOME", "EXPENSE"] } },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    });

    const sums = await db.ledgerEntry.groupBy({
      by: ["accountId"],
      where: { transaction: { date: { gte: from, lte: to } } },
      _sum: { debit: true, credit: true },
    });
    const sumMap = new Map(sums.map((s) => [s.accountId, s._sum]));

    let totalIncome = 0;
    let totalExpense = 0;
    const income: Array<{ code: string; name: string; amount: number }> = [];
    const expense: Array<{ code: string; name: string; amount: number }> = [];

    for (const a of accounts) {
      const s = sumMap.get(a.id);
      const debit = Number(s?.debit ?? 0);
      const credit = Number(s?.credit ?? 0);
      if (a.type === "INCOME") {
        const amount = credit - debit; // income accounts grow on credit
        totalIncome += amount;
        income.push({ code: a.code, name: a.name, amount });
      } else {
        const amount = debit - credit; // expense accounts grow on debit
        totalExpense += amount;
        expense.push({ code: a.code, name: a.name, amount });
      }
    }

    return ok({
      from: fromParam,
      to: toParam,
      income,
      expense,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
    });
  } catch (err) {
    console.error("[GET /api/finance/reports/pnl]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to compute P&L", 500);
  }
}

export const GET = withAuth(getPnl, [Role.FINANCE, Role.ADMIN, Role.MD]);
