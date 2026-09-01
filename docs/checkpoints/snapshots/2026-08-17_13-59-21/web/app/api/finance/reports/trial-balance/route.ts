import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

async function getTrialBalance(req: AuthedRequest) {
  try {
    const accounts = await db.chartOfAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    });

    const sums = await db.ledgerEntry.groupBy({
      by: ["accountId"],
      _sum: { debit: true, credit: true },
    });
    const sumMap = new Map(sums.map((s) => [s.accountId, s._sum]));

    let totalDebit = 0;
    let totalCredit = 0;
    const rows = accounts.map((a) => {
      const s = sumMap.get(a.id);
      const debit = Number(s?.debit ?? 0);
      const credit = Number(s?.credit ?? 0);
      totalDebit += debit;
      totalCredit += credit;
      return { accountId: a.id, code: a.code, name: a.name, type: a.type, debit, credit, balance: debit - credit };
    });

    return ok({ rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 });
  } catch (err) {
    console.error("[GET /api/finance/reports/trial-balance]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to compute trial balance", 500);
  }
}

export const GET = withAuth(getTrialBalance, [Role.FINANCE, Role.ADMIN, Role.MD]);
