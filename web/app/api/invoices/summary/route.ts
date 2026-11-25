import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { InvoicingService, InvoicingCadence } from "@/services/invoicing.service";

async function getInvoicingSummary(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cadence = (searchParams.get("cadence")?.toUpperCase() as InvoicingCadence) || "ALL";
    const date = searchParams.get("date") || undefined;
    const month = searchParams.get("month") || undefined;
    const quarter = searchParams.get("quarter") || undefined;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;
    const territoryId = searchParams.get("territoryId") || undefined;
    const subArea = searchParams.get("subArea") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const paid = searchParams.get("paid") === "true" ? true : searchParams.get("paid") === "false" ? false : undefined;
    const search = searchParams.get("search") || undefined;

    const result = await InvoicingService.getInvoicingDashboard({
      cadence,
      date,
      month,
      quarter,
      year,
      territoryId,
      subArea,
      employeeId,
      paid,
      search,
    });

    return ok({ data: result });
  } catch (err: unknown) {
    console.error("[GET /api/invoices/summary]", err);
    const msg = err instanceof Error ? err.message : "Failed to load invoicing summary";
    return apiError("INTERNAL_SERVER_ERROR", msg, 500);
  }
}

export const GET = withAuth(getInvoicingSummary, [
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
