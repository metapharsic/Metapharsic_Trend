import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";
import {
  compileIndividualMrEodData,
  formatIndividualMrWhatsAppReport,
  compileAdminExecutiveDigestData,
  formatAdminExecutiveWhatsAppDigest,
} from "@/lib/whatsapp-reports";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/mailer";

const SendReportSchema = z.object({
  targetType: z.enum(["INDIVIDUAL_MR", "ALL_MRS", "EXECUTIVE_FLEET", "CUSTOM_PHONE"]),
  employeeId: z.string().optional(),
  customPhone: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD
  sendEmailToo: z.boolean().optional().default(false),
});

/**
 * GET /api/admin/reports/whatsapp-eod
 * Previews formatted WhatsApp EOD messages for individual MRs and the Fleet Executive Digest.
 */
async function getEodReportsPreview(req: AuthedRequest) {
  try {
    const url = new URL(req.url, "http://localhost");
    const dateParam = url.searchParams.get("date");
    const employeeId = url.searchParams.get("employeeId");

    const targetDate = dateParam ? new Date(dateParam) : new Date();

    if (employeeId) {
      const eodData = await compileIndividualMrEodData(employeeId, targetDate);
      if (!eodData) return notFound("MR not found");
      const formattedText = formatIndividualMrWhatsAppReport(eodData);
      return ok({
        mode: "INDIVIDUAL",
        eodData,
        whatsappText: formattedText,
      });
    }

    const executiveData = await compileAdminExecutiveDigestData(targetDate);
    const executiveWhatsappText = formatAdminExecutiveWhatsAppDigest(executiveData);

    const mrs = await db.employee.findMany({
      where: { user: { role: "MR", isActive: true } },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { firstName: "asc" },
    });

    return ok({
      mode: "EXECUTIVE_DIGEST",
      executiveData,
      executiveWhatsappText,
      mrList: mrs.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`.trim(), phone: m.phone })),
    });
  } catch (err) {
    console.error("[GET /api/admin/reports/whatsapp-eod]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to compile WhatsApp report preview", 500);
  }
}

/**
 * POST /api/admin/reports/whatsapp-eod
 * Manually dispatches descriptive WhatsApp EOD reports to individual MRs, all MRs, or Admin phones.
 */
async function dispatchEodReports(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = SendReportSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { targetType, employeeId, customPhone, date, sendEmailToo } = parsed.data;
    const targetDate = date ? new Date(date) : new Date();

    const results: Array<{ recipient: string; phone?: string | null; sent: boolean; reason?: string }> = [];

    if (targetType === "INDIVIDUAL_MR") {
      if (!employeeId) return badRequest("employeeId is required for INDIVIDUAL_MR");
      const eodData = await compileIndividualMrEodData(employeeId, targetDate);
      if (!eodData) return notFound("MR record not found");

      const messageText = formatIndividualMrWhatsAppReport(eodData);
      const recipientPhone = customPhone || eodData.mrPhone;

      if (!recipientPhone) {
        return badRequest(`No phone number found for MR ${eodData.mrName}`);
      }

      const waRes = await sendWhatsAppMessage(recipientPhone, messageText);
      results.push({ recipient: eodData.mrName, phone: recipientPhone, sent: waRes.sent, reason: waRes.reason });

      if (sendEmailToo && eodData.mrEmail) {
        await sendEmail(eodData.mrEmail, `EOD Report — ${eodData.mrName}`, messageText);
      }
    } else if (targetType === "ALL_MRS") {
      const mrs = await db.employee.findMany({
        where: { user: { role: "MR", isActive: true } },
        include: { user: { select: { email: true } } },
      });

      for (const mr of mrs) {
        const eodData = await compileIndividualMrEodData(mr.id, targetDate);
        if (!eodData) continue;

        const messageText = formatIndividualMrWhatsAppReport(eodData);
        if (mr.phone) {
          const waRes = await sendWhatsAppMessage(mr.phone, messageText);
          results.push({ recipient: eodData.mrName, phone: mr.phone, sent: waRes.sent, reason: waRes.reason });
        } else {
          results.push({ recipient: eodData.mrName, phone: null, sent: false, reason: "missing_phone" });
        }

        if (sendEmailToo && mr.user?.email) {
          await sendEmail(mr.user.email, `EOD Report — ${eodData.mrName}`, messageText);
        }
      }
    } else if (targetType === "EXECUTIVE_FLEET") {
      const executiveData = await compileAdminExecutiveDigestData(targetDate);
      const messageText = formatAdminExecutiveWhatsAppDigest(executiveData);

      if (customPhone) {
        const waRes = await sendWhatsAppMessage(customPhone, messageText);
        results.push({ recipient: "Custom Admin Phone", phone: customPhone, sent: waRes.sent, reason: waRes.reason });
      } else {
        const management = await db.employee.findMany({
          where: { user: { role: { in: ["ADMIN", "MD"] }, isActive: true } },
          include: { user: { select: { email: true } } },
        });

        for (const mgr of management) {
          if (mgr.phone) {
            const waRes = await sendWhatsAppMessage(mgr.phone, messageText);
            results.push({ recipient: `${mgr.firstName} ${mgr.lastName}`, phone: mgr.phone, sent: waRes.sent, reason: waRes.reason });
          }
          if (sendEmailToo && mgr.user?.email) {
            await sendEmail(mgr.user.email, `Executive Fleet EOD Digest`, messageText);
          }
        }
      }
    } else if (targetType === "CUSTOM_PHONE") {
      if (!customPhone) return badRequest("customPhone is required");
      const executiveData = await compileAdminExecutiveDigestData(targetDate);
      const messageText = formatAdminExecutiveWhatsAppDigest(executiveData);
      const waRes = await sendWhatsAppMessage(customPhone, messageText);
      results.push({ recipient: "Custom Phone", phone: customPhone, sent: waRes.sent, reason: waRes.reason });
    }

    return ok({
      success: true,
      dispatchedCount: results.filter((r) => r.sent).length,
      totalTargets: results.length,
      details: results,
    });
  } catch (err) {
    console.error("[POST /api/admin/reports/whatsapp-eod]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to dispatch WhatsApp reports", 500);
  }
}

export const GET = withAuth(getEodReportsPreview, [Role.ADMIN, Role.MD, Role.ASM]);
export const POST = withAuth(dispatchEodReports, [Role.ADMIN, Role.MD]);
