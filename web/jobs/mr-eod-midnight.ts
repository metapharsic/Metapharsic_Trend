/**
 * MR EOD Midnight Intelligence Job
 *
 * Fires daily at 23:58 IST Mon–Sat (UTC cron: "58 18 * * 1-6").
 * Sends each active MR their personalized 8-domain Multi-Agent Granular Audit
 * report (Calls + Sales + Collections focus) via:
 *   1. WhatsApp  (Meta Cloud API, skipped when env not configured)
 *   2. Email     (SMTP, skipped when env not configured)
 *   3. In-App Notification (db.notification upsert per MR per day)
 *   4. WhatsApp Dispatch Audit Log (db.whatsAppDispatchLog)
 *
 * Replaces the auto-scheduling of:
 *   - daily-summary.ts    (21:00 IST)
 *   - mr-night-brief.ts   (23:00 IST)
 * Those job FILES are kept intact; their manual API triggers still call
 * runDailySummary() / runMrNightBrief() directly.
 *
 * LOCAL-ONLY — do NOT commit / push to VPS.
 */

import cron from "node-cron";
import { db } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/mailer";
import { multiAgentCouncil } from "@/lib/multi-agent-council";
import { formatEodMidnightCompactReport } from "@/lib/whatsapp-reports";

// ─── Core report runner (also callable manually from tests / API) ────────────
export async function runMrEodMidnightReport(targetDate: Date = new Date()) {
  // IST date string for notification codes and log labels
  const istDateStr = targetDate.toLocaleDateString("en-CA", {
    timeZone:  "Asia/Kolkata",
    year:      "numeric",
    month:     "2-digit",
    day:       "2-digit",
  }); // "YYYY-MM-DD"

  console.log(`[MrEodMidnightJob] Starting EOD run for ${istDateStr} …`);

  // Fetch all active MRs
  const mrs = await db.employee.findMany({
    where: { user: { role: "MR", isActive: true } },
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      phone:     true,
      user: {
        select: { email: true },
      },
    },
  });

  let waCount      = 0;
  let emailCount   = 0;
  let notifCount   = 0;
  let noPhoneCount = 0;
  let failed       = 0;

  // Sequential to avoid parallel DB overload for heavy multi-agent queries
  for (const mr of mrs) {
    try {
      // 1. Generate 8-domain granular report for today
      const report = await multiAgentCouncil.generateMrReport(mr.id, { period: "daily" });
      if (!report) {
        console.warn(`[MrEodMidnightJob] No report generated for MR ${mr.id} — skipping.`);
        failed++;
        continue;
      }

      const messageText = formatEodMidnightCompactReport(report);
      const grade       = report.councilEvaluation?.overallGrade  ?? "B";
      const score       = report.councilEvaluation?.councilScore  ?? 0;
      const mrName      = `${mr.firstName} ${mr.lastName}`.trim();

      // 2. WhatsApp delivery
      let waSent    = false;
      let waReason: string | undefined;

      if (mr.phone) {
        const waRes = await sendWhatsAppMessage(mr.phone, messageText);
        waSent    = waRes.sent;
        waReason  = "reason" in waRes ? (waRes as { sent: boolean; reason: string }).reason : undefined;
        if (waSent) waCount++;
        else { failed++; waReason = waReason ?? "api_error"; }
      } else {
        noPhoneCount++;
        waReason = "missing_phone";
      }

      // 3. WhatsApp Dispatch Audit Log
      await db.whatsAppDispatchLog.create({
        data: {
          employeeId:     mr.id,
          recipientPhone: mr.phone ?? "NO_PHONE",
          recipientName:  mrName,
          targetType:     "EOD_MIDNIGHT_MR",
          period:         "daily",
          messageText,
          sent:           waSent,
          status:         waSent ? "DELIVERED" : "FAILED",
          reason:         waReason ?? null,
          multiAgentScore: score,
          multiAgentGrade: grade,
        },
      });

      // 4. Email delivery
      if (mr.user?.email) {
        const subject  = `Trend MR — EOD Audit ${istDateStr} | ${mrName} | Grade: ${grade}`;
        const emailRes = await sendEmail(mr.user.email, subject, messageText);
        if (emailRes.sent) emailCount++;
      }

      // 5. In-App Notification (upsert — idempotent if cron retries)
      await db.notification.upsert({
        where: {
          employeeId_code: {
            employeeId: mr.id,
            code:       `EOD_MIDNIGHT_${istDateStr}`,
          },
        },
        create: {
          employeeId: mr.id,
          code:       `EOD_MIDNIGHT_${istDateStr}`,
          severity:   "SUCCESS",
          message:    `Your EOD Audit for ${istDateStr}: Grade ${grade} (${score}/100). Doctor & Chemist calls, Sales & Collections synced.`,
          action:     "/mr/reports/council",
          read:       false,
        },
        update: {
          message:  `Your EOD Audit for ${istDateStr}: Grade ${grade} (${score}/100). Doctor & Chemist calls, Sales & Collections synced.`,
          read:     false,
        },
      });
      notifCount++;

    } catch (err) {
      failed++;
      console.error(`[MrEodMidnightJob] Error processing MR ${mr.id}:`, err);
    }
  }

  const summary = [
    `[MrEodMidnightJob] ${new Date().toISOString()} — ${istDateStr}:`,
    `Processed ${mrs.length} MR(s).`,
    `WhatsApp: ${waCount} sent, ${noPhoneCount} no-phone, ${failed} failed.`,
    `Email: ${emailCount} sent.`,
    `Notifications: ${notifCount} upserted.`,
  ].join(" ");
  console.log(summary);

  return {
    mrsProcessed: mrs.length,
    waCount,
    emailCount,
    notifCount,
    noPhoneCount,
    failed,
    dateStr: istDateStr,
  };
}

// ─── Cron scheduler ──────────────────────────────────────────────────────────
export function startMrEodMidnightJob() {
  /**
   * Cron: "58 18 * * 1-6"
   * = 18:58 UTC  = 23:58 + 5:30 IST offset corrected:
   *   IST 23:58 = UTC 18:28 … but to be safe and hit exactly 23:58 IST we use:
   *   UTC = 23:58 IST − 5h30m = 18:28 UTC  → cron "28 18 * * 1-6"
   *
   * dow 1-6 = Monday through Saturday; never fires on Sunday (0).
   */
  cron.schedule("28 18 * * 1-6", async () => {
    try {
      await runMrEodMidnightReport();
    } catch (err) {
      console.error("[MrEodMidnightJob] Fatal scheduler error:", err);
    }
  });

  console.log(
    "[MrEodMidnightJob] Scheduled — fires at 23:58 IST Mon–Sat" +
    " (8-domain Multi-Agent granular audit + WhatsApp + Email + In-App Notification to each active MR)."
  );
}
