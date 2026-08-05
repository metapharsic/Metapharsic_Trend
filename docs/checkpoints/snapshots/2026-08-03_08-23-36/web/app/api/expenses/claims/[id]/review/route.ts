import { PrismaClient, Role, ExpenseStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { ExpenseReviewSchema } from "@/lib/validators";

const db = new PrismaClient();

async function reviewClaim(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = ExpenseReviewSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return notFound("Expense claim not found");
    if (existing.status !== ExpenseStatus.PENDING_ASM) {
      return badRequest("Only claims pending approval can be reviewed");
    }

    const expense = await db.expense.update({
      where: { id },
      data: {
        status: parsed.data.status as ExpenseStatus,
        auditNotes: parsed.data.auditNotes,
      },
    });

    return ok({ expense });
  } catch (err) {
    console.error("[PUT /api/expenses/claims/[id]/review]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to review expense claim", 500);
  }
}

export const PUT = withAuth(reviewClaim, [Role.ASM, Role.ADMIN]);
