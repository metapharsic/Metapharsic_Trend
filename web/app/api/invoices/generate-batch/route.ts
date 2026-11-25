import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { InvoicingService, InvoicingCadence } from "@/services/invoicing.service";

async function generateBatchInvoices(req: AuthedRequest) {
  try {
    const body = await req.json();
    const { cadence, date, month, quarter, territoryId, subArea, orderIds } = body || {};
    let { employeeId } = body || {};

    if (req.user.role === Role.MR) {
      const emp = await db.employee.findUnique({ where: { userId: req.user.sub }, select: { id: true } });
      if (!emp) return unauthorized("Employee record not found");
      employeeId = emp.id;
    }

    const result = await InvoicingService.generateBatchInvoices({
      cadence: cadence as InvoicingCadence,
      date,
      month,
      quarter,
      territoryId,
      subArea,
      employeeId,
      orderIds,
    });

    return ok(result);
  } catch (err: unknown) {
    console.error("[POST /api/invoices/generate-batch]", err);
    const msg = err instanceof Error ? err.message : "Failed to execute batch invoice generation";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const POST = withAuth(generateBatchInvoices, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
  Role.FINANCE,
  Role.WAREHOUSE,
]);
