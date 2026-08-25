import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, forbidden } from "@/lib/api-response";
import { multiAgentCouncil } from "@/lib/multi-agent-council";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const period = (searchParams.get("period") as any) || "all";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const timeFilter = {
      period: period as "daily" | "weekly" | "monthly" | "custom" | "all",
      startDate,
      endDate,
    };

    const isManager = req.user.role === Role.ADMIN || req.user.role === Role.MD || req.user.role === Role.NSM || req.user.role === Role.ZSM || req.user.role === Role.RM || req.user.role === Role.ASM;

    if (employeeId) {
      if (!isManager && req.user.role === Role.MR) {
        // MR can only query their own report
        const report = await multiAgentCouncil.generateMrReport(req.user.sub, timeFilter);
        if (!report || report.userId !== req.user.sub) {
          return forbidden("You can only view your own Multi-Agent Council report");
        }
        return ok(report);
      }
      const report = await multiAgentCouncil.generateMrReport(employeeId, timeFilter);
      if (!report) {
        return apiError("NOT_FOUND", "MR report could not be generated or MR not found", 404);
      }
      return ok(report);
    }

    // Return for current user if MR, or all MRs if Manager/Admin
    if (req.user.role === Role.MR) {
      const report = await multiAgentCouncil.generateMrReport(req.user.sub, timeFilter);
      return ok({ reports: report ? [report] : [] });
    }

    const allReports = await multiAgentCouncil.generateAllMrReports(timeFilter);
    return ok({
      totalMrs: allReports.length,
      timeFilter,
      environment: process.env.NODE_ENV === "production" || process.env.VPS_ENV ? "VPS_PRODUCTION" : "LOCAL",
      timestamp: new Date().toISOString(),
      reports: allReports,
    });
  } catch (err) {
    console.error("[GET /api/mr/reports/multi-agent]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to run Multi-Agent Council evaluation", 500);
  }
}

export const GET = withAuth(handler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
]);
