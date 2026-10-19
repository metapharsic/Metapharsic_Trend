import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const PLINK_PATH = "C:\\Program Files\\PuTTY\\plink.exe";
const SSH_KEY_PATH = "C:\\Trend_MR\\vps_key.ppk";
const VPS_HOST = "root@187.127.169.217";
const VPS_DB_PASS = "TrendMr2026Secure";

export function runVpsSql(sql: string): string {
  const b64 = Buffer.from(sql).toString("base64");
  const cmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "echo ${b64} | base64 -d | PGPASSWORD=${VPS_DB_PASS} psql -h localhost -U trend_mr_user -d trend_mr -t -A"`;
  try {
    return execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch (err: any) {
    return `ERROR: ${err.message}`;
  }
}

async function main() {
  const localDb = new PrismaClient();
  console.log("=== USERS (MR) ===");
  const users = await localDb.user.findMany({
    where: { role: "MR" },
    include: { employee: true }
  });
  console.log(users.map(u => ({ id: u.id, email: u.email, employeeId: u.employee?.id, name: `${u.employee?.firstName} ${u.employee?.lastName}` })));

  console.log("=== ALL ATTENDANCES WITH CHECKOUT (LOCAL & VPS) ===");
  const localCheckouts = await localDb.attendance.findMany({
    where: { checkOut: { not: null } },
    include: { employee: true }
  });
  console.log("Local checkouts:", localCheckouts.map(c => ({
    emp: `${c.employee.firstName} ${c.employee.lastName}`,
    date: c.date.toISOString().split("T")[0],
    checkIn: c.checkIn.toISOString(),
    checkOut: c.checkOut?.toISOString(),
  })));

  const vpsCheckouts = runVpsSql(`
    SELECT e."firstName" || ' ' || e."lastName" || ' | Date: ' || a."date"::text || ' | In: ' || a."checkIn"::text || ' | Out: ' || a."checkOut"::text
    FROM "Attendance" a
    JOIN "Employee" e ON a."employeeId" = e."id"
    WHERE a."checkOut" IS NOT NULL
    ORDER BY a."date" DESC;
  `);
  console.log("VPS checkouts:\n", vpsCheckouts);

  console.log("=== LOCATION LOGS RECENT ===");
  const locLogs = await localDb.locationLog.findMany({
    take: 20,
    orderBy: { recordedAt: "desc" }
  });
  console.log(locLogs.map(l => ({
    empId: l.employeeId,
    time: l.recordedAt.toISOString(),
    lat: l.latitude,
    lng: l.longitude
  })));

  console.log("=== TOUR PLAN DAYS FOR MRs IN OCTOBER ===");
  const tpDays = await localDb.tourPlanDay.findMany({
    where: {
      tourPlan: { employee: { user: { role: "MR" } } }
    },
    orderBy: { date: "desc" },
    take: 30,
    include: { tourPlan: { include: { employee: true } } }
  });
  console.log(tpDays.map(d => ({
    emp: `${d.tourPlan.employee.firstName} ${d.tourPlan.employee.lastName}`,
    date: d.date.toISOString().split("T")[0],
    beatName: d.beatName,
    subArea: d.subArea,
    isCompleted: d.isCompleted,
    visitStatus: d.visitStatus,
    completedAt: d.completedAt?.toISOString()
  })));

  console.log("=== TOUR PLAN (LOCAL) ===");
  const tourPlans = await localDb.tourPlan.findMany({
    orderBy: { month: "desc" },
    include: {
      employee: true,
      days: { take: 5, orderBy: { date: "desc" } }
    }
  });
  console.log(tourPlans.map(tp => ({
    id: tp.id,
    emp: `${tp.employee.firstName} ${tp.employee.lastName}`,
    month: tp.month.toISOString(),
    status: tp.status,
    recentDays: tp.days.map(d => ({ date: d.date.toISOString(), visitStatus: d.visitStatus, isCompleted: d.isCompleted }))
  })));

  console.log("=== VISITS (LOCAL) DATES SUMMARY ===");
  const visits = await localDb.visit.findMany({
    select: { createdAt: true, startedAt: true, endedAt: true, employeeId: true }
  });
  console.log(`Total local visits: ${visits.length}`);
  const visitDates = [...new Set(visits.map(v => v.createdAt.toISOString().split("T")[0]))].sort();
  console.log("Unique visit dates:", visitDates);

  console.log("=== ORDERS (LOCAL) DATES SUMMARY ===");
  const orders = await localDb.order.findMany({
    select: { createdAt: true, employeeId: true }
  });
  console.log(`Total local orders: ${orders.length}`);
  const orderDates = [...new Set(orders.map(o => o.createdAt.toISOString().split("T")[0]))].sort();
  console.log("Unique order dates:", orderDates);

  await localDb.$disconnect();
}

main().catch(console.error);
