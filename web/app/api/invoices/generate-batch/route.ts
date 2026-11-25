import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { InvoicingService, InvoicingCadence } from "@/services/invoicing.service";

async function generateBatchInvoices(req: AuthedRequest) {
  try {
    const body = await req.json();
    const { cadence, date, month, quarter, territoryId, subArea, employeeId, orderIds } = body || {};

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

    return ok({ data: result });
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
  Role.FINANCE,
  Role.WAREHOUSE,
]);
