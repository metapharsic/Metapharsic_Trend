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
  let whatsappSentCount = 0;

  for (const mr of mrs) {
    const [attendanceSessions, visits, leads, orderItems, collections, samples] = await Promise.all([
      db.attendance.findMany({ where: { employeeId: mr.id, date: todayStart }, orderBy: { checkIn: "asc" } }),
      db.visit.findMany({
        where: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } },
        select: { boxesPlaced: true, doctorId: true, chemistId: true },
      }),
      db.lead.count({ where: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } } }),
      db.orderItem.findMany({
        where: { order: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } } },
        select: { price: true, quantity: true },
      }),
      db.collection.aggregate({
        where: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } },
        _sum: { amount: true },
      }),
      db.sample.findMany({
        where: { visit: { employeeId: mr.id, createdAt: { gte: todayStart, lt: todayEnd } } },
        select: { quantity: true },
      }),
    ]);

    // Multiple check-in/out sessions can now exist per day — sum across all of them.
    const hoursMinutes = attendanceSessions.reduce(
      (sum, a) => sum + Math.round(((a.checkOut ?? new Date()).getTime() - a.checkIn.getTime()) / 60000),
      0
    );
    const latestSession = attendanceSessions[attendanceSessions.length - 1];
    const stillCheckedIn = attendanceSessions.length > 0 && !latestSession.checkOut;
    const boxesPlaced = visits.reduce((s, v) => s + (v.boxesPlaced ?? 0), 0);
    const doctorCalls = visits.filter((v) => v.doctorId).length;
    const chemistCalls = visits.filter((v) => v.chemistId).length;
    const salesToday = orderItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const collectionToday = Number(collections._sum.amount ?? 0);
    const samplesGiven = samples.reduce((s, x) => s + x.quantity, 0);

    const lines = [
      `EOD Report — ${mr.firstName} ${mr.lastName} — ${todayStart.toISOString().slice(0, 10)}`,
      ``,
      `Logged in: ${attendanceSessions.length > 0 ? fmtHours(hoursMinutes) + (stillCheckedIn ? " (still checked in)" : "") : "Did not check in"}`,
      `Calls made: ${visits.length} (Doctors: ${doctorCalls}, Chemists: ${chemistCalls})`,
      `Boxes placed: ${boxesPlaced}`,
      `Samples given: ${samplesGiven}`,
      `Orders booked: ₹${salesToday.toFixed(2)}`,
      `Collections: ₹${collectionToday.toFixed(2)}`,
      `Leads generated: ${leads}`,
    ];
    const summaryText = lines.join("\n");

    if (mr.user.email) {
      const result = await sendEmail(mr.user.email, `EOD Report — ${mr.firstName} ${mr.lastName}`, summaryText);
      if (result.sent) sentCount++;
    }
    if (mr.phone) {
      const waResult = await sendWhatsAppMessage(mr.phone, summaryText);
      if (waResult.sent) whatsappSentCount++;
    }
  }

  console.log(`[DailySummaryJob] Processed ${mrs.length} MR(s), ${sentCount} email(s), ${whatsappSentCount} whatsapp msg(s) sent at ${new Date().toISOString()}`);
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
