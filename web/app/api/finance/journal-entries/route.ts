import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, apiError } from "@/lib/api-response";
import { z } from "zod";

const CreateJournalSchema = z.object({
  date: z.coerce.date(),
  narration: z.string().min(1),
  entries: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        debit: z.coerce.number().min(0).default(0),
        credit: z.coerce.number().min(0).default(0),
      })
    )
    .min(2),
});

async function listJournalEntries(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = 25;

    const [transactions, total] = await Promise.all([
      db.ledgerTransaction.findMany({
        include: { entries: { include: { account: { select: { code: true, name: true } } } } },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.ledgerTransaction.count(),
    ]);

    return ok({ transactions, pagination: { page, pageSize, total } });
  } catch (err) {
    console.error("[GET /api/finance/journal-entries]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch journal entries", 500);
  }
}

/**
 * Manual double-entry journal. Auto-posted entries (Invoice/Collection/Expense/
 * Payroll) go through web/lib/ledger.ts inline in their own route handlers, not
 * through this endpoint — this is for FINANCE-authored manual adjustments only.
 */
async function createJournalEntry(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateJournalSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { date, narration, entries } = parsed.data;
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return badRequest(`Entry unbalanced: debit ${totalDebit} != credit ${totalCredit}`);
    }

    const accountIds = entries.map((e) => e.accountId);
    const foundAccounts = await db.chartOfAccount.count({ where: { id: { in: accountIds } } });
    if (foundAccounts !== new Set(accountIds).size) {
      return badRequest("One or more account IDs are invalid");
    }

    const transaction = await db.ledgerTransaction.create({
      data: {
        date,
        narration,
        sourceType: "MANUAL",
        createdById: req.user.sub,
        entries: { create: entries.map((e) => ({ accountId: e.accountId, debit: e.debit, credit: e.credit })) },
      },
      include: { entries: true },
    });

    return created({ transaction });
  } catch (err) {
    console.error("[POST /api/finance/journal-entries]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create journal entry", 500);
  }
}

export const GET = withAuth(listJournalEntries, [Role.FINANCE, Role.ADMIN, Role.MD]);
export const POST = withAuth(createJournalEntry, [Role.FINANCE, Role.ADMIN]);
