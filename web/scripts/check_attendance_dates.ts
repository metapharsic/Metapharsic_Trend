import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  console.log("=== LOCAL ATTENDANCE >= OCT 14 ===");
  const localAtt = await db.attendance.findMany({
    where: { date: { gte: new Date("2026-10-14T00:00:00Z") } },
    include: { employee: true }
  });
  console.log("Local count:", localAtt.length);
  for (const a of localAtt) {
    console.log(`Local: ${a.date.toISOString().slice(0, 10)} | ${a.employee.firstName} ${a.employee.lastName} | in: ${a.checkIn.toISOString()} | out: ${a.checkOut?.toISOString()}`);
  }

  console.log("\n=== VPS ATTENDANCE >= OCT 14 ===");
  const vpsAttSql = `
    SELECT a."date"::text, e."firstName" || ' ' || e."lastName" as emp, a."checkIn"::text, a."checkOut"::text
    FROM "Attendance" a
    JOIN "Employee" e ON a."employeeId" = e."id"
    WHERE a."date" >= '2026-10-14'
    ORDER BY a."date" DESC;
  `;
  console.log(runVpsSql(vpsAttSql));

  console.log("\n=== VPS ATTENDANCE LATEST 10 OVERALL ===");
  const vpsRecentAttSql = `
    SELECT a."date"::text, e."firstName" || ' ' || e."lastName" as emp, a."checkIn"::text, a."checkOut"::text
    FROM "Attendance" a
    JOIN "Employee" e ON a."employeeId" = e."id"
    ORDER BY a."date" DESC
    LIMIT 10;
  `;
  console.log(runVpsSql(vpsRecentAttSql));
}

main().then(() => process.exit(0)).catch(console.error);
