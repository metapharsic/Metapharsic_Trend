import { db } from "../lib/db";
import { startOfUtcDay, addUtcDays } from "../lib/date";

async function main() {
  console.log("=== VERIFYING DASHBOARD & REPORTS LOGIC ===");

  const today = startOfUtcDay(new Date("2026-10-19T12:00:00Z"));
  const tomorrow = addUtcDays(today, 1);

  // 1. Team Today Logic
  const employees = await db.employee.findMany({
    where: { user: { role: "MR" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      territories: { select: { name: true } },
    },
    orderBy: { firstName: "asc" },
  });

  const employeeIds = employees.map((e) => e.id);

  const [attendanceToday, visitsToday, orderItemsToday] = await Promise.all([
    db.attendance.findMany({
      where: { employeeId: { in: employeeIds }, date: today },
      orderBy: { checkIn: "asc" },
    }),
    db.visit.findMany({
      where: { employeeId: { in: employeeIds }, createdAt: { gte: today, lt: tomorrow } },
      select: { employeeId: true },
    }),
    db.orderItem.findMany({
      where: { order: { employeeId: { in: employeeIds }, createdAt: { gte: today, lt: tomorrow } } },
      select: { price: true, quantity: true, order: { select: { employeeId: true } } },
    }),
  ]);

  const visitCountByEmp = new Map<string, number>();
  for (const v of visitsToday) {
    visitCountByEmp.set(v.employeeId, (visitCountByEmp.get(v.employeeId) ?? 0) + 1);
  }

  const attendanceByEmp = new Map(attendanceToday.map((a) => [a.employeeId, a]));

  console.log(`\n--- TEAM TODAY DASHBOARD (${today.toISOString().slice(0, 10)}) ---`);
  for (const emp of employees) {
    const att = attendanceByEmp.get(emp.id);
    const calls = visitCountByEmp.get(emp.id) ?? 0;
    const inTime = att?.checkIn ? att.checkIn.toLocaleTimeString("en-IN") : "NONE";
    const outTime = att?.checkOut ? att.checkOut.toLocaleTimeString("en-IN") : "NONE";
    console.log(`  ${(emp.firstName + " " + emp.lastName).padEnd(25)} | Calls: ${String(calls).padEnd(2)} | Login: ${inTime.padEnd(11)} | Logout: ${outTime.padEnd(11)} | Status: ${att ? "PRESENT" : "ABSENT"}`);
  }

  // 2. Friday (Oct 16) Verification
  const friday = startOfUtcDay(new Date("2026-10-16T12:00:00Z"));
  const fridayEnd = addUtcDays(friday, 1);
  const [attendanceFriday, visitsFriday] = await Promise.all([
    db.attendance.findMany({
      where: { employeeId: { in: employeeIds }, date: friday },
      orderBy: { checkIn: "asc" },
    }),
    db.visit.findMany({
      where: { employeeId: { in: employeeIds }, createdAt: { gte: friday, lt: fridayEnd } },
      select: { employeeId: true },
    }),
  ]);

  const fridayVisitCounts = new Map<string, number>();
  for (const v of visitsFriday) {
    fridayVisitCounts.set(v.employeeId, (fridayVisitCounts.get(v.employeeId) ?? 0) + 1);
  }
  const fridayAttMap = new Map(attendanceFriday.map((a) => [a.employeeId, a]));

  // 3. Tuesday Oct 20 (Today) Verification
  const oct20 = startOfUtcDay(new Date("2026-10-20T12:00:00Z"));
  const oct20End = addUtcDays(oct20, 1);
  const [attendance20, visits20, orders20] = await Promise.all([
    db.attendance.findMany({
      where: { employeeId: { in: employeeIds }, date: oct20 },
      orderBy: { checkIn: "asc" },
    }),
    db.visit.findMany({
      where: { employeeId: { in: employeeIds }, createdAt: { gte: oct20, lt: oct20End } },
      select: { employeeId: true },
    }),
    db.order.findMany({
      where: { employeeId: { in: employeeIds }, createdAt: { gte: oct20, lt: oct20End } },
      include: { items: true },
    }),
  ]);

  const v20Map = new Map<string, number>();
  for (const v of visits20) v20Map.set(v.employeeId, (v20Map.get(v.employeeId) ?? 0) + 1);
  const o20Map = new Map<string, number>();
  const s20Map = new Map<string, number>();
  for (const o of orders20) {
    if (!o.employeeId) continue;
    o20Map.set(o.employeeId, (o20Map.get(o.employeeId) ?? 0) + 1);
    const sum = o.items.reduce((acc, it) => acc + Number(it.price) * it.quantity, 0);
    s20Map.set(o.employeeId, (s20Map.get(o.employeeId) ?? 0) + sum);
  }
  const att20Map = new Map(attendance20.map((a) => [a.employeeId, a]));

  console.log(`\n--- TODAY DASHBOARD (${oct20.toISOString().slice(0, 10)}) ---`);
  for (const emp of employees) {
    const att = att20Map.get(emp.id);
    const calls = v20Map.get(emp.id) ?? 0;
    const ords = o20Map.get(emp.id) ?? 0;
    const sales = s20Map.get(emp.id) ?? 0;
    const inTime = att?.checkIn ? att.checkIn.toLocaleTimeString("en-IN") : "NONE";
    const outTime = att?.checkOut ? att.checkOut.toLocaleTimeString("en-IN") : "NONE";
    console.log(`  ${(emp.firstName + " " + emp.lastName).padEnd(25)} | Calls: ${String(calls).padEnd(2)} | Orders: ${ords} (Rs ${sales.toFixed(2)}) | Login: ${inTime.padEnd(11)} | Logout: ${outTime.padEnd(11)} | Status: ${att ? "PRESENT" : "ABSENT"}`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
