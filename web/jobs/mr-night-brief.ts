import cron from "node-cron";
import { db } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  compileIndividualMrEodData,
  formatIndividualMrBriefWhatsAppReport,
  compileAdminExecutiveDigestData,
  formatAdminExecutiveBriefWhatsAppDigest,
} from "@/lib/whatsapp-reports";

/**
 * Sends a SHORT nightly brief (not the full multi-agent council wall-of-text)
 * to every active MR's WhatsApp number, plus a fleet brief to Admin/MD.
 * Real send via lib/whatsapp.ts -- Meta WhatsApp Cloud API. Requires
 * WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN in env; if unset, each
 * send is skipped and logged (no fake success).
 */
export async function runMrNightBrief(targetDate: Date = new Date()) {
  const mrs = await db.employee.findMany({
    where: { user: { role: "MR", isActive: true } },
    include: { user: { select: { email: true } } },
  });

  let mrSent = 0;
  let mrSkippedNoPhone = 0;
  let mrFailed = 0;

  for (const mr of mrs) {
    if (!mr.phone) {
      mrSkippedNoPhone++;
      continue;
    }
    const eodData = await compileIndividualMrEodData(mr.id, targetDate);
    if (!eodData) continue;

    const briefText = formatIndividualMrBriefWhatsAppReport(eodData);
    const waResult = await sendWhatsAppMessage(mr.phone, briefText);
    if (waResult.sent) {
      mrSent++;
    } else {
      mrFailed++;
      console.warn(`[MrNightBriefJob] WhatsApp send skipped/failed for ${eodData.mrName} (${mr.phone}): ${waResult.reason}`);
    }
  }

  // Fleet brief to Admin/MD
  const executiveData = await compileAdminExecutiveDigestData(targetDate);
  const executiveBriefText = formatAdminExecutiveBriefWhatsAppDigest(executiveData);

  const management = await db.employee.findMany({
    where: { user: { role: { in: ["ADMIN", "MD"] }, isActive: true } },
  });

  let adminSent = 0;
  for (const mgr of management) {
    if (!mgr.phone) continue;
    const waResult = await sendWhatsAppMessage(mgr.phone, executiveBriefText);
    if (waResult.sent) adminSent++;
  }

  const logMessage = `[MrNightBriefJob] ${new Date().toISOString()} -- MR brief: sent ${mrSent}/${mrs.length} (no-phone ${mrSkippedNoPhone}, failed ${mrFailed}); Admin brief: sent ${adminSent}/${management.length}`;
  console.log(logMessage);

  return { mrsProcessed: mrs.length, mrSent, mrSkippedNoPhone, mrFailed, adminSent };
}

export function startMrNightBriefJob() {
  // 23:00 IST daily = 17:30 UTC
  cron.schedule("30 17 * * *", async () => {
    try {
      await runMrNightBrief();
    } catch (err) {
      console.error("[MrNightBriefJob] Error executing scheduled 11PM brief:", err);
    }
  });
  console.log("[MrNightBriefJob] Scheduled -- runs daily at 23:00 IST (brief WhatsApp report to all active MRs)");
}
