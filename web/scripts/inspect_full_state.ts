import { db } from "../lib/db";

async function main() {
  const visits = await db.visit.findMany({
    select: { createdAt: true, employeeId: true }
  });
  const visitDays: Record<string, number> = {};
  for (const v of visits) {
    const d = v.createdAt.toISOString().slice(0, 10);
    visitDays[d] = (visitDays[d] || 0) + 1;
  }
  console.log("Visits by day:", Object.entries(visitDays).sort());

  const atts = await db.attendance.findMany({
    select: {
      date: true,
      checkIn: true,
      checkOut: true,
      employee: { select: { firstName: true, lastName: true } }
    },
    orderBy: { date: "asc" }
  });
  console.log("Attendance count:", atts.length);
  const attSummary: Record<string, string[]> = {};
  for (const a of atts) {
    const d = a.date.toISOString().slice(0, 10);
    if (!attSummary[d]) attSummary[d] = [];
    attSummary[d].push(`${a.employee.firstName} ${a.employee.lastName} (in:${a.checkIn.toISOString().slice(11,16)} out:${a.checkOut ? a.checkOut.toISOString().slice(11,16) : 'none'})`);
  }
  console.log("Attendance by day:", attSummary);

  const orders = await db.order.findMany({
    select: { createdAt: true }
  });
  const orderDays: Record<string, number> = {};
  for (const o of orders) {
    const d = o.createdAt.toISOString().slice(0, 10);
    orderDays[d] = (orderDays[d] || 0) + 1;
  }
  console.log("Orders by day:", Object.entries(orderDays).sort());

  const tourDays = await db.tourPlanDay.findMany({
    where: {
      date: { gte: new Date("2026-10-15T00:00:00Z"), lte: new Date("2026-10-22T00:00:00Z") }
    },
    select: { date: true, isCompleted: true, visitStatus: true }
  });
  const tourSummary: Record<string, { total: number; completed: number; pending: number }> = {};
  for (const t of tourDays) {
    const d = t.date.toISOString().slice(0, 10);
    if (!tourSummary[d]) tourSummary[d] = { total: 0, completed: 0, pending: 0 };
    tourSummary[d].total++;
    if (t.isCompleted) tourSummary[d].completed++;
    else tourSummary[d].pending++;
  }
  console.log("Tour plan days (Oct 15 - Oct 22):", tourSummary);
}

main().then(() => process.exit(0)).catch(console.error);
