import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, apiError } from "@/lib/api-response";
import { z } from "zod";
import { postAutoLedger, reverseAutoLedger, SYSTEM_ACCOUNT_CODES } from "@/lib/ledger";

const UpdatePaidSchema = z.object({
  paid: z.boolean(),
});

// Invoices are GST documents — line items and amounts are never edited or
// deleted after issue (that's what a credit note is for). The only thing
// that legitimately changes post-issue is payment status.
async function updateInvoice(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdatePaidSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) return notFound("Invoice not found");

    // Only the unpaid -> paid transition is a real cash event worth posting.
    // Re-saving paid:true or toggling paid:false back is not reversed here —
    // reversing a receipt is a manual journal entry (credit note territory),
    // not an automatic re-post.
    const shouldPost = parsed.data.paid && !existing.paid;

    const updated = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: { paid: parsed.data.paid },
      });

      if (shouldPost) {
        await postAutoLedger(tx, {
          sourceType: "INVOICE",
          sourceId: `${id}-payment`,
          date: new Date(),
          narration: `Payment received — Invoice ${inv.invoiceNo}`,
          lines: [
            { accountCode: SYSTEM_ACCOUNT_CODES.bank, debit: Number(inv.grandTotal ?? inv.amount) },
            { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, credit: Number(inv.grandTotal ?? inv.amount) },
          ],
        });
      }

      return inv;
    });

    return ok({ invoice: updated });
  } catch (err) {
    console.error("[PUT /api/invoices/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update invoice", 500);
  }
}

async function deleteInvoice(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const existing = await db.invoice.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!existing) return notFound("Invoice not found");

    if (req.user.role === Role.MR) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee || existing.order.employeeId !== employee.id) {
        return forbidden("You may only delete invoices for orders you booked yourself");
      }
    }

    await db.$transaction(async (tx) => {
      // Clear ledger postings associated with this invoice (sale & payment)
      await reverseAutoLedger(tx, "INVOICE", existing.id);
      if (existing.paid) {
        await reverseAutoLedger(tx, "INVOICE", `${existing.id}-payment`);
      }

      await tx.invoice.delete({ where: { id } });
    });

    return ok({ message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/invoices/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete invoice", 500);
  }
}

export const PUT = withAuth(updateInvoice, [Role.ASM, Role.ADMIN, Role.MD]);
export const DELETE = withAuth(deleteInvoice, [Role.ADMIN, Role.ASM, Role.MD, Role.MR]);
