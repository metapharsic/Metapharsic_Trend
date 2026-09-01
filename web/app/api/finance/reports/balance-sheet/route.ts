import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";

/**
 * Assets = Liabilities + Equity. We don't post to Equity directly (no
 * dividend/capital flows modeled yet), so cumulative net income up to
 * `asOf` is surfaced as a computed "Retained Earnings" line — without it
 * the sheet would never balance once any income/expense has posted.
 */
async function getBalanceSheet(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const asOfParam = searchParams.get("asOf");
    const asOf = asOfParam ? new Date(asOfParam) : new Date();
    if (Number.isNaN(asOf.getTime())) return badRequest("Invalid 'asOf' date");

    const accounts = await db.chartOfAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    });

    const sums = await db.ledgerEntry.groupBy({
      by: ["accountId"],
      where: { transaction: { date: { lte: asOf } } },
      _sum: { debit: true, credit: true },
    });
    const sumMap = new Map(sums.map((s) => [s.accountId, s._sum]));

    let totalAssets = 0;
    let totalLiabilities = 0;
    let retainedEarnings = 0;
    const assets: Array<{ code: string; name: string; balance: number }> = [];
    const liabilities: Array<{ code: string; name: string; balance: number }> = [];

    for (const a of accounts) {
      const s = sumMap.get(a.id);
      const debit = Number(s?.debit ?? 0);
      const credit = Number(s?.credit ?? 0);
      if (a.type === "ASSET") {
        const balance = debit - credit;
        totalAssets += balance;
        assets.push({ code: a.code, name: a.name, balance });
      } else if (a.type === "LIABILITY") {
        const balance = credit - debit;
        totalLiabilities += balance;
        liabilities.push({ code: a.code, name: a.name, balance });
      } else if (a.type === "INCOME") {
        retainedEarnings += credit - debit;
      } else if (a.type === "EXPENSE") {
        retainedEarnings -= debit - credit;
      }
    }

    const totalEquity = retainedEarnings;

    return ok({
      asOf: asOf.toISOString().slice(0, 10),
      assets,
      liabilities,
      totalAssets,
      totalLiabilities,
      retainedEarnings,
      totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    });
  } catch (err) {
    console.error("[GET /api/finance/reports/balance-sheet]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to compute balance sheet", 500);
  }
}

export const GET = withAuth(getBalanceSheet, [Role.FINANCE, Role.ADMIN, Role.MD]);
