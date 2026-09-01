import cron from "node-cron";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  compileIndividualMrEodData,
  formatIndividualMrWhatsAppReport,
  compileAdminExecutiveDigestData,
  formatAdminExecutiveWhatsAppDigest,
} from "@/lib/whatsapp-reports";

export async function runDailySummary(targetDate: Date = new Date()) {
  const mrs = await db.employee.findMany({
    where: { user: { role: "MR", isActive: true } },
    include: { user: { select: { email: true } } },
  });

  let mrEmailCount = 0;
  let mrWhatsAppCount = 0;
  let adminEmailCount = 0;
  let adminWhatsAppCount = 0;

  // 1. Dispatch individual descriptive EOD reports to each MR
  for (const mr of mrs) {
    const eodData = await compileIndividualMrEodData(mr.id, targetDate);
    if (!eodData) continue;

    const reportText = formatIndividualMrWhatsAppReport(eodData);

    if (mr.user?.email) {
      const emailResult = await sendEmail(
        mr.user.email,
        `EOD Performance Report — ${eodData.mrName} (${eodData.date.toISOString().slice(0, 10)})`,
        reportText
      );
      if (emailResult.sent) mrEmailCount++;
    }

    if (mr.phone) {
      const waResult = await sendWhatsAppMessage(mr.phone, reportText);
      if (waResult.sent) mrWhatsAppCount++;
    }
  }

  // 2. Dispatch Executive Fleet Digest to Admins and Managing Directors
  const executiveData = await compileAdminExecutiveDigestData(targetDate);
  const executiveDigestText = formatAdminExecutiveWhatsAppDigest(executiveData);

  const managementUsers = await db.employee.findMany({
    where: {
      user: {
        role: { in: ["ADMIN", "MD", "NSM"] },
        isActive: true,
      },
    },
    include: { user: { select: { email: true } } },
  });

  for (const mgr of managementUsers) {
    if (mgr.user?.email) {
      const emailResult = await sendEmail(
        mgr.user.email,
        `Executive Fleet EOD Digest — ${executiveData.date.toISOString().slice(0, 10)}`,
        executiveDigestText
      );
      if (emailResult.sent) adminEmailCount++;
    }

    if (mgr.phone) {
      const waResult = await sendWhatsAppMessage(mgr.phone, executiveDigestText);
      if (waResult.sent) adminWhatsAppCount++;
    }
  }

  const logMessage = `[DailySummaryJob] Processed ${mrs.length} MR(s) [Emails: ${mrEmailCount}, WhatsApp: ${mrWhatsAppCount}] & ${managementUsers.length} Admin/MD(s) [Emails: ${adminEmailCount}, WhatsApp: ${adminWhatsAppCount}] at ${new Date().toISOString()}`;
  console.log(logMessage);

  return {
    mrsProcessed: mrs.length,
    mrEmailCount,
    mrWhatsAppCount,
    managementProcessed: managementUsers.length,
    adminEmailCount,
    adminWhatsAppCount,
    executiveData,
  };
}

export function startDailySummaryJob() {
  // 21:00 IST daily = 15:30 UTC
  cron.schedule("30 15 * * *", async () => {
    try {
      await runDailySummary();
    } catch (err) {
      console.error("[DailySummaryJob] Error executing scheduled EOD summary:", err);
    }
  });
  console.log("[DailySummaryJob] Scheduled — runs daily at 21:00 IST (Personalized MR EOD Reports + Admin Executive Digest)");
}
