import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError, forbidden } from "@/lib/api-response";
import { z } from "zod";
import { multiAgentCouncil } from "@/lib/multi-agent-council";
import {
  formatMultiAgentCouncilWhatsAppReport,
  formatMultiAgentCouncilExecutiveDigest,
} from "@/lib/whatsapp-reports";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/mailer";
import { db } from "@/lib/db";

const SendReportSchema = z.object({
  targetType: z.enum(["INDIVIDUAL_MR", "ALL_MRS", "EXECUTIVE_FLEET", "CUSTOM_PHONE"]),
  employeeId: z.string().optional(),
  customPhone: z.string().optional(),
  sendEmailToo: z.boolean().optional().default(false),
  period: z.enum(["daily", "weekly", "monthly", "custom", "all"]).optional().default("all"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeDoctorVisits: z.boolean().optional().default(true),
  includeChemistCalls: z.boolean().optional().default(true),
  includeSalesOrders: z.boolean().optional().default(true),
  includeCollections: z.boolean().optional().default(true),
  includeDutyTiming: z.boolean().optional().default(true),
  includeExpenses: z.boolean().optional().default(true),
  includeRoutingGeofence: z.boolean().optional().default(true),
  includeFinancePnl: z.boolean().optional().default(true),
  includeAgentScorecard: z.boolean().optional().default(true),
  includeRiskActionItems: z.boolean().optional().default(true),
});

function sanitizePhoneForWhatsAppUrl(phone: string): string {
  // Remove non-digit chars except leading plus
  let cleaned = phone.replace(/[^0-9]/g, "");
  // If 10 digits (e.g. Indian mobile without country code), prepend 91
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }
  return cleaned;
}

/**
 * GET /api/mr/reports/multi-agent/whatsapp
 * Generates formatted WhatsApp Multi-Agent Council report text and direct click-to-chat links.
 */
async function getMultiAgentWhatsAppPreview(req: AuthedRequest) {
  try {
    const url = new URL(req.url, "http://localhost");
    const employeeId = url.searchParams.get("employeeId") || url.searchParams.get("mrId");
    const customPhone = url.searchParams.get("customPhone");
    const period = (url.searchParams.get("period") as any) || "all";
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    const parseBool = (param: string | null, def = true) => {
      if (param === null) return def;
      return param === "true" || param === "1";
    };

    const options = {
      period,
      startDate,
      endDate,
      includeDoctorVisits: parseBool(url.searchParams.get("includeDoctorVisits")),
      includeChemistCalls: parseBool(url.searchParams.get("includeChemistCalls")),
      includeSalesOrders: parseBool(url.searchParams.get("includeSalesOrders")),
      includeCollections: parseBool(url.searchParams.get("includeCollections")),
      includeDutyTiming: parseBool(url.searchParams.get("includeDutyTiming")),
      includeExpenses: parseBool(url.searchParams.get("includeExpenses")),
      includeRoutingGeofence: parseBool(url.searchParams.get("includeRoutingGeofence")),
      includeFinancePnl: parseBool(url.searchParams.get("includeFinancePnl")),
      includeAgentScorecard: parseBool(url.searchParams.get("includeAgentScorecard")),
      includeRiskActionItems: parseBool(url.searchParams.get("includeRiskActionItems")),
    };

    const timeFilter = {
      period: period as "daily" | "weekly" | "monthly" | "custom" | "all",
      startDate,
      endDate,
    };

    const isManager = ([
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
    ] as Role[]).includes(req.user.role as Role);

    if (employeeId) {
      if (!isManager && req.user.role === Role.MR) {
        const myReport = await multiAgentCouncil.generateMrReport(req.user.sub, timeFilter);
        if (!myReport || (myReport.userId !== req.user.sub && myReport.mrId !== employeeId)) {
          return forbidden("You can only view your own Multi-Agent Council report");
        }
      }

      const report = await multiAgentCouncil.generateMrReport(employeeId, timeFilter);
      if (!report) return notFound("MR report could not be generated or MR not found");

      const whatsappText = formatMultiAgentCouncilWhatsAppReport(report, options);
      const recipientPhone = customPhone || report.phone;
      const cleanPhone = recipientPhone ? sanitizePhoneForWhatsAppUrl(recipientPhone) : "";
      const whatsappUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}`
        : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

      return ok({
        mode: "INDIVIDUAL",
        mrId: report.mrId,
        mrName: report.fullName,
        phone: recipientPhone,
        whatsappText,
        whatsappUrl,
        report,
        options,
      });
    }

    // If MR user without employeeId, default to their own report
    if (req.user.role === Role.MR) {
      const report = await multiAgentCouncil.generateMrReport(req.user.sub, timeFilter);
      if (!report) return notFound("Report not found for current MR");
      const whatsappText = formatMultiAgentCouncilWhatsAppReport(report, options);
      const cleanPhone = report.phone ? sanitizePhoneForWhatsAppUrl(report.phone) : "";
      const whatsappUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}`
        : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

      return ok({
        mode: "INDIVIDUAL",
        mrId: report.mrId,
        mrName: report.fullName,
        phone: report.phone,
        whatsappText,
        whatsappUrl,
        report,
        options,
      });
    }

    // Fleet Executive Digest for Managers
    const allReports = await multiAgentCouncil.generateAllMrReports(timeFilter);
    const whatsappText = formatMultiAgentCouncilExecutiveDigest(allReports);
    const cleanPhone = customPhone ? sanitizePhoneForWhatsAppUrl(customPhone) : "";
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

    return ok({
      mode: "EXECUTIVE_DIGEST",
      totalMrs: allReports.length,
      whatsappText,
      whatsappUrl,
      options,
      mrList: allReports.map((r) => ({
        id: r.mrId,
        name: r.fullName,
        phone: r.phone,
        grade: r.councilEvaluation.overallGrade,
        score: r.councilEvaluation.councilScore,
      })),
    });
  } catch (err) {
    console.error("[GET /api/mr/reports/multi-agent/whatsapp]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to generate Multi-Agent WhatsApp preview", 500);
  }
}

/**
 * POST /api/mr/reports/multi-agent/whatsapp
 * Dispatches Multi-Agent Council WhatsApp reports to MRs, Admins, or custom phone numbers.
 */
async function dispatchMultiAgentWhatsAppReport(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = SendReportSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const {
      targetType,
      employeeId,
      customPhone,
      sendEmailToo,
      period,
      startDate,
      endDate,
      ...selectiveOptions
    } = parsed.data;

    const timeFilter = {
      period: period as "daily" | "weekly" | "monthly" | "custom" | "all",
      startDate,
      endDate,
    };

    const options = {
      period,
      startDate,
      endDate,
      ...selectiveOptions,
    };

    const results: Array<{ recipient: string; phone?: string | null; sent: boolean; reason?: string; whatsappUrl?: string }> = [];

    if (targetType === "INDIVIDUAL_MR") {
      if (!employeeId) return badRequest("employeeId is required for INDIVIDUAL_MR");
      const report = await multiAgentCouncil.generateMrReport(employeeId, timeFilter);
      if (!report) return notFound("MR report not found");

      const messageText = formatMultiAgentCouncilWhatsAppReport(report, options);
      const recipientPhone = customPhone || report.phone;

      if (!recipientPhone) {
        return badRequest(`No phone number found for MR ${report.fullName}`);
      }

      const cleanPhone = sanitizePhoneForWhatsAppUrl(recipientPhone);
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
      const waRes = await sendWhatsAppMessage(recipientPhone, messageText);

      results.push({
        recipient: report.fullName,
        phone: recipientPhone,
        sent: waRes.sent,
        reason: waRes.reason,
        whatsappUrl: waUrl,
      });

      if (sendEmailToo && report.email) {
        await sendEmail(report.email, `Multi-Agent Council Audit Report — ${report.fullName}`, messageText);
      }

      return ok({
        success: true,
        dispatchedCount: results.filter((r) => r.sent).length,
        totalTargets: 1,
        details: results,
        whatsappText: messageText,
        whatsappUrl: waUrl,
      });
    }

    if (targetType === "ALL_MRS") {
      const allReports = await multiAgentCouncil.generateAllMrReports(timeFilter);
      for (const report of allReports) {
        const messageText = formatMultiAgentCouncilWhatsAppReport(report, options);
        if (report.phone) {
          const cleanPhone = sanitizePhoneForWhatsAppUrl(report.phone);
          const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
          const waRes = await sendWhatsAppMessage(report.phone, messageText);
          results.push({
            recipient: report.fullName,
            phone: report.phone,
            sent: waRes.sent,
            reason: waRes.reason,
            whatsappUrl: waUrl,
          });
        } else {
          results.push({
            recipient: report.fullName,
            phone: null,
            sent: false,
            reason: "missing_phone",
          });
        }

        if (sendEmailToo && report.email) {
          await sendEmail(report.email, `Multi-Agent Council Audit Report — ${report.fullName}`, messageText);
        }
      }

      return ok({
        success: true,
        dispatchedCount: results.filter((r) => r.sent).length,
        totalTargets: allReports.length,
        details: results,
      });
    }

    if (targetType === "EXECUTIVE_FLEET") {
      const allReports = await multiAgentCouncil.generateAllMrReports(timeFilter);
      const messageText = formatMultiAgentCouncilExecutiveDigest(allReports);

      if (customPhone) {
        const cleanPhone = sanitizePhoneForWhatsAppUrl(customPhone);
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
        const waRes = await sendWhatsAppMessage(customPhone, messageText);
        results.push({
          recipient: "Custom Executive Phone",
          phone: customPhone,
          sent: waRes.sent,
          reason: waRes.reason,
          whatsappUrl: waUrl,
        });

        return ok({
          success: true,
          dispatchedCount: waRes.sent ? 1 : 0,
          totalTargets: 1,
          details: results,
          whatsappText: messageText,
          whatsappUrl: waUrl,
        });
      }

      const management = await db.employee.findMany({
        where: { user: { role: { in: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"] }, isActive: true } },
        include: { user: { select: { email: true } } },
      });

      for (const mgr of management) {
        if (mgr.phone) {
          const cleanPhone = sanitizePhoneForWhatsAppUrl(mgr.phone);
          const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
          const waRes = await sendWhatsAppMessage(mgr.phone, messageText);
          results.push({
            recipient: `${mgr.firstName} ${mgr.lastName}`,
            phone: mgr.phone,
            sent: waRes.sent,
            reason: waRes.reason,
            whatsappUrl: waUrl,
          });
        }
        if (sendEmailToo && mgr.user?.email) {
          await sendEmail(mgr.user.email, "Fleet Multi-Agent Executive Council Digest", messageText);
        }
      }

      const cleanPhone = management[0]?.phone ? sanitizePhoneForWhatsAppUrl(management[0].phone) : "";
      const waUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
        : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

      return ok({
        success: true,
        dispatchedCount: results.filter((r) => r.sent).length,
        totalTargets: management.length,
        details: results,
        whatsappText: messageText,
        whatsappUrl: waUrl,
      });
    }

    if (targetType === "CUSTOM_PHONE") {
      if (!customPhone) return badRequest("customPhone is required");
      const cleanPhone = sanitizePhoneForWhatsAppUrl(customPhone);

      let messageText = "";
      if (employeeId) {
        const report = await multiAgentCouncil.generateMrReport(employeeId);
        if (!report) return notFound("MR report not found");
        messageText = formatMultiAgentCouncilWhatsAppReport(report);
      } else {
        const allReports = await multiAgentCouncil.generateAllMrReports();
        messageText = formatMultiAgentCouncilExecutiveDigest(allReports);
      }

      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
      const waRes = await sendWhatsAppMessage(customPhone, messageText);
      results.push({
        recipient: "Custom Phone",
        phone: customPhone,
        sent: waRes.sent,
        reason: waRes.reason,
        whatsappUrl: waUrl,
      });

      return ok({
        success: true,
        dispatchedCount: waRes.sent ? 1 : 0,
        totalTargets: 1,
        details: results,
        whatsappText: messageText,
        whatsappUrl: waUrl,
      });
    }

    return badRequest("Invalid targetType specified");
  } catch (err) {
    console.error("[POST /api/mr/reports/multi-agent/whatsapp]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to dispatch Multi-Agent WhatsApp report", 500);
  }
}

export const GET = withAuth(getMultiAgentWhatsAppPreview, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
]);

export const POST = withAuth(dispatchMultiAgentWhatsAppReport, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
]);
