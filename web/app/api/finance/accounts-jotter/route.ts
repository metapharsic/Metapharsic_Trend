import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";
import { z } from "zod";

const JotEntrySchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD
  type: z.enum(["FIELD_EXPENSE", "OFFICE_EXPENSE", "COLLECTION_INFLOW", "VENDOR_PAYMENT", "SALARY_ADVANCE", "CUSTOM_ENTRY"]),
  amount: z.number().positive(),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI"]),
  narration: z.string().min(1, "Narration or memo is required to jot the account"),
  referenceNo: z.string().optional(),
  customDebitAccountId: z.string().optional(),
  customCreditAccountId: z.string().optional(),
});

/**
 * Rapid Bookkeeping & Accounts Jotter API
 * Allows Admin and Finance to quickly record balanced journal & ledger transactions in seconds.
 */
async function postJotEntry(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = JotEntrySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const { date, type, amount, paymentMode, narration, referenceNo, customDebitAccountId, customCreditAccountId } = parsed.data;
    const entryDate = date ? new Date(`${date}T12:00:00.000Z`) : new Date();

    // Map payment mode to Account Code
    const paymentAccountCode = paymentMode === "CASH" ? SYSTEM_ACCOUNT_CODES.cash : SYSTEM_ACCOUNT_CODES.bank;

    // Load Chart of Accounts lookup
    const allAccounts = await db.chartOfAccount.findMany({ select: { id: true, code: true, name: true } });
    const byCode = new Map(allAccounts.map((a) => [a.code, a]));

    let debitAccountId: string | undefined;
    let creditAccountId: string | undefined;

    switch (type) {
      case "FIELD_EXPENSE": {
        debitAccountId = byCode.get(SYSTEM_ACCOUNT_CODES.travelAndFieldExpense)?.id || byCode.get("5002")?.id;
        creditAccountId = byCode.get(paymentAccountCode)?.id;
        break;
      }
      case "OFFICE_EXPENSE": {
        debitAccountId = byCode.get(SYSTEM_ACCOUNT_CODES.officeAdminExpense)?.id || byCode.get("5008")?.id || byCode.get("5002")?.id;
        creditAccountId = byCode.get(paymentAccountCode)?.id;
        break;
      }
      case "COLLECTION_INFLOW": {
        debitAccountId = byCode.get(paymentAccountCode)?.id;
        creditAccountId = byCode.get(SYSTEM_ACCOUNT_CODES.accountsReceivable)?.id || byCode.get("1100")?.id || byCode.get(SYSTEM_ACCOUNT_CODES.salesRevenue)?.id;
        break;
      }
      case "VENDOR_PAYMENT": {
        debitAccountId = byCode.get(SYSTEM_ACCOUNT_CODES.accountsPayable)?.id || byCode.get("2001")?.id;
        creditAccountId = byCode.get(paymentAccountCode)?.id;
        break;
      }
      case "SALARY_ADVANCE": {
        debitAccountId = byCode.get(SYSTEM_ACCOUNT_CODES.salaryExpense)?.id || byCode.get("5001")?.id;
        creditAccountId = byCode.get(paymentAccountCode)?.id;
        break;
      }
      case "CUSTOM_ENTRY": {
        debitAccountId = customDebitAccountId;
        creditAccountId = customCreditAccountId;
        break;
      }
    }

    if (!debitAccountId || !creditAccountId) {
      return badRequest("Could not resolve debit or credit accounts in Chart of Accounts. Please verify master accounts exist.");
    }

    if (debitAccountId === creditAccountId) {
      return badRequest("Debit account and Credit account cannot be the same.");
    }

    // Execute atomic double-entry posting
    const transaction = await db.$transaction(async (tx) => {
      const fullNarration = referenceNo ? `${narration} (Ref: ${referenceNo})` : narration;

      const ledgerTx = await tx.ledgerTransaction.create({
        data: {
          date: entryDate,
          narration: `[JOT] ${fullNarration}`,
          sourceType: "MANUAL",
          entries: {
            create: [
              { accountId: debitAccountId!, debit: amount, credit: 0 },
              { accountId: creditAccountId!, debit: 0, credit: amount },
            ],
          },
        },
        include: {
          entries: {
            include: { account: { select: { code: true, name: true } } },
          },
        },
      });

      return ledgerTx;
    });

    return ok({
      message: "Account entry jotted and balanced successfully.",
      transaction,
    });
  } catch (err: any) {
    console.error("[POST /api/finance/accounts-jotter]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to post jotted account entry", 500);
  }
}

async function getJotSummary(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // defaults to today

    const targetDate = dateParam ? new Date(`${dateParam}T00:00:00.000Z`) : new Date();
    const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // Fetch recent manual / jotted transactions
    const transactions = await db.ledgerTransaction.findMany({
      where: {
        date: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        entries: {
          include: { account: { select: { id: true, code: true, name: true, type: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also fetch all available accounts for custom dropdown selection
    const accounts = await db.chartOfAccount.findMany({
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: "asc" },
    });

    // Compute totals
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const tx of transactions) {
      for (const e of tx.entries) {
        // Cash or Bank debit is inflow; Cash or Bank credit is outflow
        if (e.account.code === "1001" || e.account.code === "1002") {
          totalInflow += Number(e.debit || 0);
          totalOutflow += Number(e.credit || 0);
        }
      }
    }

    return ok({
      date: startOfDay.toISOString().slice(0, 10),
      summary: {
        totalInflow,
        totalOutflow,
        netPosition: totalInflow - totalOutflow,
        totalTransactions: transactions.length,
      },
      transactions: transactions.map((t) => ({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        time: t.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        narration: t.narration,
        sourceType: t.sourceType,
        entries: t.entries.map((e) => ({
          id: e.id,
          accountName: e.account.name,
          accountCode: e.account.code,
          accountType: e.account.type,
          debit: Number(e.debit),
          credit: Number(e.credit),
        })),
      })),
      accounts,
    });
  } catch (err: any) {
    console.error("[GET /api/finance/accounts-jotter]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch accounts jotter data", 500);
  }
}

export const POST = withAuth(postJotEntry, [Role.ADMIN, Role.FINANCE, Role.MD]);
export const GET = withAuth(getJotSummary, [Role.ADMIN, Role.FINANCE, Role.MD]);
