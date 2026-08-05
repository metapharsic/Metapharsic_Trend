import cron from "node-cron";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { startOfUtcDay, addUtcDays } from "@/lib/date";

function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export async function runDailySummary() {
  const todayStart = startOfUtcDay();
  const todayEnd = addUtcDays(todayStart, 1);

  const mrs = await db.employee.findMany({
    where: { user: { role: "MR", isActive: true } },
    include: { user: { select: { email: true } } },
  });

  let sentCount = 0;

  for (const mr of mrs) {
    const [attendance, visits, leads] = await Promise.all([
      db.attendance.findFirst({ where: { employeeId: mr.id, date: todayStart } }),
      db.visit.findMany({ where: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } } }),
      db.lead.count({ where: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } } }),
    ]);

    const hoursMinutes = attendance
      ? Math.round(((attendance.checkOut ?? new Date()).getTime() - attendance.checkIn.getTime()) / 60000)
      : 0;
    const boxesPlaced = visits.reduce((s, v) => s + (v.boxesPlaced ?? 0), 0);

    const lines = [
      `Daily Summary — ${mr.firstName} ${mr.lastName} — ${todayStart.toISOString().slice(0, 10)}`,
      ``,
      `Logged in: ${attendance ? fmtHours(hoursMinutes) + (attendance.checkOut ? "" : " (still checked in)") : "Did not check in"}`,
      `Calls made: ${visits.length}`,
      `Boxes placed: ${boxesPlaced}`,
      `Leads generated: ${leads}`,
    ];
    const summaryText = lines.join("\n");

    if (mr.user.email) {
      const result = await sendEmail(mr.user.email, `Daily Summary — ${mr.firstName} ${mr.lastName}`, summaryText);
      if (result.sent) sentCount++;
    }
    if (mr.phone) {
      await sendWhatsAppMessage(mr.phone, summaryText);
    }
  }

  console.log(`[DailySummaryJob] Processed ${mrs.length} MR(s), ${sentCount} email(s) sent at ${new Date().toISOString()}`);
}

export function startDailySummaryJob() {
  // 21:00 IST daily = 15:30 UTC
  cron.schedule("30 15 * * *", async () => {
    try {
      await runDailySummary();
    } catch (err) {
      console.error("[DailySummaryJob] Error:", err);
    }
  });
  console.log("[DailySummaryJob] Scheduled — runs daily at 21:00 IST");
}
