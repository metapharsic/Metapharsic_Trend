import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { ItemHistoryAgentsService } from "@/services/item-history-agents.service";

async function getItemHistoryReport(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get("sku") || searchParams.get("productId") || searchParams.get("name") || undefined;
    const report = await ItemHistoryAgentsService.generateItemAuditReport(sku);
    return ok(report);
  } catch (err) {
    console.error("[GET /api/reports/item-history]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to generate item supply chain history report", 500);
  }
}

export const GET = withAuth(getItemHistoryReport, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
  Role.WAREHOUSE,
  Role.FINANCE,
]);
