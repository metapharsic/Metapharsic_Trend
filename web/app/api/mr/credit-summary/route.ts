import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { CreditAgentsService } from "@/services/credit-agents.service";

/**
 * MR's own multi-agent credit & collections intelligence.
 */
async function getCreditSummary(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({
      where: { userId: req.user.sub },
    });
    if (!employee) return unauthorized("Employee record not found");

    const pipelineResponse = await CreditAgentsService.executeCreditPipeline({
      employeeId: employee.id,
    });
    const data = pipelineResponse.creditData;

    const chemists = data.chemists.map((c) => ({
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
    }));

    const attentionNeeded = chemists.filter(
      (r) => r.status === "WARNING" || r.status === "BREACHED" || r.riskTier === "CRITICAL"
    );

    return ok({
      chemists,
      totalOutstanding: data.summary.totalOutstanding,
      aging0To30: data.summary.aging0To30,
      aging31To60: data.summary.aging31To60,
      aging61To90: data.summary.aging61To90,
      aging90Plus: data.summary.aging90Plus,
      attentionNeeded,
      todaysCollection: data.summary.todaysCollection,
      monthCollection: data.summary.monthCollection,
      collectionsList: data.recentCollections,
      riskAlerts: data.riskAlerts,
      agents: pipelineResponse.agents,
      timestamp: pipelineResponse.timestamp,
    });
  } catch (err) {
    console.error("[GET /api/mr/credit-summary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch credit summary", 500);
  }
}

export const GET = withAuth(getCreditSummary, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
