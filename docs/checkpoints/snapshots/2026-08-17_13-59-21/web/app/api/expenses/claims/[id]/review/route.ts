import { db } from "@/lib/db";
import { Role, ExpenseStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { ExpenseReviewSchema } from "@/lib/validators";
import { postAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";


// Each pending status has exactly one role tier (besides ADMIN, who can always
// act) authorized to approve/reject it, and a defined next step on approval.
// PENDING_ASM's next step branches on ExpenseLimit — within policy, an ASM
// approval is terminal; over policy, it escalates to RM instead of the ASM
// being able to silently rubber-stamp an over-limit claim.
const STAGE_RULES: Record<string, { approverRoles: Role[]; nextOnApprove: ExpenseStatus }> = {
  [ExpenseStatus.PENDING_ASM]: { approverRoles: [Role.ASM], nextOnApprove: ExpenseStatus.APPROVED },
  [ExpenseStatus.PENDING_RM]: { approverRoles: [Role.RM], nextOnApprove: ExpenseStatus.PENDING_FINANCE },
  [ExpenseStatus.PENDING_FINANCE]: { approverRoles: [Role.FINANCE], nextOnApprove: ExpenseStatus.APPROVED },
};

async function reviewClaim(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = ExpenseReviewSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.expense.findUnique({
      where: { id },
      include: { employee: { include: { user: { select: { role: true } } } } },
    });
    if (!existing) return notFound("Expense claim not found");

    const stage = STAGE_RULES[existing.status];
    if (!stage) {
      return badRequest("Only claims pending approval can be reviewed");
    }
    if (req.user.role !== Role.ADMIN && !stage.approverRoles.includes(req.user.role as Role)) {
      return badRequest(`This claim is awaiting ${stage.approverRoles.join("/")} review, not yours`);
    }

    let nextStatus: ExpenseStatus = parsed.data.status as ExpenseStatus;
    if (parsed.data.status === "APPROVED") {
      nextStatus = stage.nextOnApprove;

      // Policy check only applies at the ASM stage — an ASM approval of an
      // over-limit claim doesn't finalize it, it escalates to RM instead.
      if (existing.status === ExpenseStatus.PENDING_ASM) {
        const limit = await db.expenseLimit.findUnique({
          where: { role_category: { role: existing.employee.user.role, category: existing.category } },
        });
        if (limit && Number(existing.amount) > Number(limit.limitAmount)) {
          nextStatus = ExpenseStatus.PENDING_RM;
        }
      }
    }

    const expense = await db.$transaction(async (tx) => {
      const e = await tx.expense.update({
        where: { id },
        data: {
          status: nextStatus,
          auditNotes: parsed.data.auditNotes,
        },
      });

      if (e.status === ExpenseStatus.APPROVED) {
        await postAutoLedger(tx, {
          sourceType: "EXPENSE",
          sourceId: e.id,
          date: e.createdAt,
          narration: `Expense approved — ${e.category}${e.description ? `: ${e.description}` : ""}`,
          lines: [
            { accountCode: SYSTEM_ACCOUNT_CODES.generalExpense, debit: Number(e.amount) },
            { accountCode: SYSTEM_ACCOUNT_CODES.cash, credit: Number(e.amount) },
          ],
        });
      }

      return e;
    });

    return ok({ expense });
  } catch (err) {
    console.error("[PUT /api/expenses/claims/[id]/review]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to review expense claim", 500);
  }
}

export const PUT = withAuth(reviewClaim, [Role.ASM, Role.RM, Role.FINANCE, Role.ADMIN]);
