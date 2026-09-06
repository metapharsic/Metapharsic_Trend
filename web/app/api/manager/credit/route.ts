import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { CreditAgentsService } from "@/services/credit-agents.service";

/**
 * Company-wide multi-agent credit exposure & aging intelligence pipeline.
 */
async function getCreditOverview(req: AuthedRequest) {
  try {
    const pipelineResponse = await CreditAgentsService.executeCreditPipeline();
    const data = pipelineResponse.creditData;

    return ok({
      chemists: data.chemists.map((c) => ({
        chemistId: c.chemistId,
        name: c.chemistName,
        address: c.address,
        territory: c.territoryName,
        mr: c.mrName,
        creditLimit: c.creditLimit,
        limitUtilizationPct: c.limitUtilizationPct,
        outstanding: c.totalOutstanding,
        status: c.status,
        aging0To30: c.current0To30,
        aging31To60: c.overdue31To60,
        aging61To90: c.overdue61To90,
        aging90Plus: c.overdue90Plus,
        dsoDays: c.dsoDays,
        riskTier: c.riskTier,
        riskScore: c.riskScore,
        unpaidInvoicesCount: c.unpaidInvoicesCount,
        openInvoices: c.openInvoices,
        lastPaymentDate: c.lastPaymentDate,
        lastPaymentAmount: c.lastPaymentAmount,
      })),
      totalOutstanding: data.summary.totalOutstanding,
      aging0To30: data.summary.aging0To30,
      aging31To60: data.summary.aging31To60,
      aging61To90: data.summary.aging61To90,
      aging90Plus: data.summary.aging90Plus,
      breachedCount: data.summary.breachedCount,
      warningCount: data.summary.warningCount,
      todaysCollection: data.summary.todaysCollection,
      monthCollection: data.summary.monthCollection,
      collectionsList: data.recentCollections,
      riskAlerts: data.riskAlerts,
      agents: pipelineResponse.agents,
      timestamp: pipelineResponse.timestamp,
    });
  } catch (err) {
    console.error("[GET /api/manager/credit]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch credit overview", 500);
  }
}

export const GET = withAuth(getCreditOverview, [
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.FINANCE,
]);
