import { db } from "@/lib/db";
import { ExpenseStatus, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, conflict, apiError } from "@/lib/api-response";
import { ExpenseClaimSchema } from "@/lib/validators";
import { saveReceiptFile, receiptUrl } from "@/lib/upload";


async function uploadExpenseClaim(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const formData = await req.formData();
    const raw = {
      amount: formData.get("amount"),
      category: formData.get("category"),
      description: formData.get("description") || undefined,
    };
    const parsed = ExpenseClaimSchema.safeParse(raw);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { amount, category, description } = parsed.data;

    let receiptPath: string | null = null;
    let receiptHash: string | null = null;

    const receiptFile = formData.get("receipt") as File | null;
    if (receiptFile && receiptFile.size > 0) {
      const uploadResult = await saveReceiptFile(receiptFile, employee.id);
      if (!uploadResult.ok) return badRequest(uploadResult.error.message);

      const duplicate = await db.expense.findFirst({ where: { receiptHash: uploadResult.result.hash } });
      if (duplicate) return conflict("This receipt has already been submitted (duplicate detected)");

      receiptPath = uploadResult.result.relativePath;
      receiptHash = uploadResult.result.hash;
    }

    const expense = await db.expense.create({
      data: {
        employeeId: employee.id,
        amount,
        category,
        description,
        receiptUrl: receiptPath,
        receiptHash,
        status: ExpenseStatus.PENDING_ASM,
      },
    });

    return ok({
      expense: { ...expense, receiptUrl: receiptPath ? receiptUrl(receiptPath) : null },
    });
  } catch (err) {
    console.error("[POST /api/expenses/claims/upload]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to submit expense claim", 500);
  }
}

export const POST = withAuth(uploadExpenseClaim, [Role.MR]);
