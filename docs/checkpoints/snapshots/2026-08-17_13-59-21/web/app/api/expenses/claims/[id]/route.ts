import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { UpdateExpenseSchema } from "@/lib/validators";
import { ok, forbidden, notFound, apiError, badRequest, conflict } from "@/lib/api-response";

const EDITABLE_STATUSES = ["PENDING_ASM", "PENDING_RM", "PENDING_FINANCE"];

async function updateExpense(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const expense = await db.expense.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!expense) return notFound("Expense claim not found");
    if (expense.employee.userId !== req.user.sub) return forbidden();
    if (!EDITABLE_STATUSES.includes(expense.status)) {
      return conflict("This claim has already been decided and can no longer be edited");
    }

    const body = await req.json();
    const parsed = UpdateExpenseSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const updated = await db.expense.update({ where: { id }, data: parsed.data });
    return ok({ expense: updated });
  } catch (err) {
    console.error("[PUT /api/expenses/claims/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update expense claim", 500);
  }
}

async function deleteExpense(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const expense = await db.expense.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!expense) return notFound("Expense claim not found");
    if (expense.employee.userId !== req.user.sub) return forbidden();
    if (!EDITABLE_STATUSES.includes(expense.status)) {
      return conflict("This claim has already been decided and can no longer be deleted");
    }

    await db.expense.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    console.error("[DELETE /api/expenses/claims/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete expense claim", 500);
  }
}

export const PUT = withAuth(updateExpense, [Role.MR]);
export const DELETE = withAuth(deleteExpense, [Role.MR]);
