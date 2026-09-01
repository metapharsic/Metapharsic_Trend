import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, apiError } from "@/lib/api-response";
import {
  BiReportQuerySchema,
  MultiAgentReportQuerySchema,
  WhatsAppDispatchSchema,
} from "./reports.schema";
import { ReportsService } from "./reports.service";

const UNSCOPED_ROLES = new Set<Role>([Role.ADMIN, Role.MD, Role.NSM]);

async function getScopeTerritoryIds(req: AuthedRequest): Promise<string[] | null> {
  if (UNSCOPED_ROLES.has(req.user.role as Role)) return null;
  const employee = await import("@/lib/db").then((m) =>
    m.db.employee.findUnique({
      where: { userId: req.user.sub },
      include: { territories: { select: { id: true } } },
    })
  );
  return employee ? employee.territories.map((t) => t.id) : [];
}

/**
 * GET /api/reports - BI Enterprise Analytics
 */
export async function getBiReportsHandler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = BiReportQuerySchema.safeParse({
      report: searchParams.get("report") ?? undefined,
      timeframe: searchParams.get("timeframe") ?? "this_month",
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      territoryId: searchParams.get("territoryId") ?? undefined,
    });

    if (!parsed.success) {
      return badRequest("Invalid query parameters", parsed.error.flatten());
    }

    const territoryIds = await getScopeTerritoryIds(req);
    const result = await ReportsService.runBiReport(parsed.data, territoryIds);
    return ok(result);
  } catch (err: any) {
    console.error("[GET /api/reports]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to generate BI report", 500);
  }
}

/**
 * GET /api/reports/multi-agent - Multi-Agent Evaluation & Status
 */
export async function getMultiAgentReportsHandler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = MultiAgentReportQuerySchema.safeParse({
      employeeId: searchParams.get("employeeId") ?? undefined,
      period: searchParams.get("period") ?? "all",
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      includeDoctorVisits: searchParams.get("includeDoctorVisits") ?? true,
    });

    if (!parsed.success) {
      return badRequest("Invalid query parameters", parsed.error.flatten());
    }

    const isManager =
      req.user.role === Role.ADMIN ||
      req.user.role === Role.MD ||
      req.user.role === Role.NSM ||
      req.user.role === Role.ZSM ||
      req.user.role === Role.RM ||
      req.user.role === Role.ASM;

    if (parsed.data.employeeId) {
      if (!isManager && req.user.role === Role.MR) {
        const report = await ReportsService.generateMrMultiAgentReport(req.user.sub, parsed.data);
        if (!report || report.userId !== req.user.sub) {
          return forbidden("You can only view your own Multi-Agent Council report");
        }
        return ok(report);
      }

      const report = await ReportsService.generateMrMultiAgentReport(parsed.data.employeeId, parsed.data);
      if (!report) {
        return notFound("MR report could not be generated or MR not found");
      }
      return ok(report);
    }

    // For MR without employeeId param
    if (req.user.role === Role.MR) {
      const report = await ReportsService.generateMrMultiAgentReport(req.user.sub, parsed.data);
      return ok({ reports: report ? [report] : [] });
    }

    // For Managers/Admin
    const allReports = await ReportsService.generateAllMrMultiAgentReports(parsed.data);
    return ok({
      totalMrs: allReports.length,
      timeFilter: parsed.data,
      timestamp: new Date().toISOString(),
      reports: allReports,
    });
  } catch (err) {
    console.error("[GET /api/reports/multi-agent]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to run Multi-Agent Council evaluation", 500);
  }
}

/**
 * GET /api/reports/council-status - Live Agent Status Dashboard
 */
export async function getCouncilStatusHandler(_req: AuthedRequest) {
  try {
    const statusBoard = await ReportsService.getCouncilStatusBoard();
    return ok(statusBoard);
  } catch (err) {
    console.error("[GET /api/reports/council-status]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch council status board", 500);
  }
}

// Protected Route Exports
export const getBiReportsRoute = withAuth(getBiReportsHandler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.FINANCE,
]);
export const getMultiAgentReportsRoute = withAuth(getMultiAgentReportsHandler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
]);
export const getCouncilStatusRoute = withAuth(getCouncilStatusHandler, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
]);
