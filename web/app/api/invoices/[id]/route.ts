import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";

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

    const updated = await db.invoice.update({
      where: { id },
      data: { paid: parsed.data.paid },
    });

    return ok({ invoice: updated });
  } catch (err) {
    console.error("[PUT /api/invoices/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update invoice", 500);
  }
}

export const PUT = withAuth(updateInvoice, [Role.ASM, Role.ADMIN]);
