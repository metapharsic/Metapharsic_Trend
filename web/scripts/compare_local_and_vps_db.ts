import { db } from "../lib/db";
import { execSync } from "child_process";
import * as path from "path";

const PLINK_PATH = 'C:\\Program Files\\PuTTY\\plink.exe';
const SSH_KEY_PATH = 'C:\\Trend_MR\\vps_key.ppk';
const VPS_HOST = 'root@187.127.169.217';
const VPS_DB_PASS = 'TrendMr2026Secure';

function runVpsSql(sql: string): string {
  const b64 = Buffer.from(sql).toString("base64");
  const cmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "echo ${b64} | base64 -d | PGPASSWORD=${VPS_DB_PASS} psql -h localhost -U trend_mr_user -d trend_mr -t -A"`;
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch (err: any) {
    return `ERROR: ${err.message}`;
  }
}

async function main() {
  console.log("=== COMPARING LOCAL POSTGRESQL VS VPS POSTGRESQL ===");

  const tables = [
    "User",
    "Employee",
    "Doctor",
    "Chemist",
    "Visit",
    "Order",
    "TourPlan",
    "Attendance",
    "Territory",
    "Product",
  ];

  console.log("\n--- TABLE RECORD COUNTS ---");
  console.log("Table".padEnd(20) + "Local".padEnd(15) + "VPS".padEnd(15) + "Match?");

  for (const table of tables) {
    let localCount = 0;
    try {
      const res: any = await (db as any)[table.toLowerCase()].count();
      localCount = res;
    } catch {
      try {
        const raw: any = await db.$queryRawUnsafe(`SELECT count(*)::int as c FROM "${table}"`);
        localCount = raw[0]?.c ?? 0;
      } catch (e: any) {
        localCount = -1;
      }
    }

    const vpsCountStr = runVpsSql(`SELECT count(*) FROM "${table}"`);
    const vpsCount = parseInt(vpsCountStr, 10);

    const match = localCount === vpsCount ? "✅ MATCH" : `❌ DIFF (${localCount - vpsCount})`;
    console.log(table.padEnd(20) + String(localCount).padEnd(15) + String(vpsCountStr).padEnd(15) + match);
  }

  // Compare Visits in detail
  console.log("\n--- VISIT DETAILS COMPARISON ---");
  const localVisitsCount = await db.visit.count();
  const localFirstVisit = await db.visit.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const localLastVisit = await db.visit.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  console.log("Local Visits:", localVisitsCount, "Range:", localFirstVisit?.createdAt, "to", localLastVisit?.createdAt);

  const vpsVisitRange = runVpsSql(`SELECT count(*), min("createdAt"), max("createdAt") FROM "Visit"`);
  console.log("VPS Visits Range:", vpsVisitRange);

  // Group visits by employee
  console.log("\n--- LOCAL VISITS PER EMPLOYEE ---");
  const localByEmp = await db.visit.groupBy({
    by: ["employeeId"],
    _count: true,
  });
  for (const item of localByEmp) {
    const emp = await db.employee.findUnique({ where: { id: item.employeeId }, select: { firstName: true, lastName: true } });
    console.log(`  ${emp?.firstName} ${emp?.lastName} (${item.employeeId}): ${item._count} visits`);
  }

  console.log("\n--- VPS VISITS PER EMPLOYEE ---");
  const vpsByEmp = runVpsSql(`SELECT concat(e."firstName", ' ', e."lastName"), count(v."id") FROM "Visit" v JOIN "Employee" e ON v."employeeId" = e."id" GROUP BY e."firstName", e."lastName" ORDER BY count(v."id") DESC;`);
  console.log(vpsByEmp);

  // Check Deal Closure Opportunities
  console.log("\n--- DEAL CLOSURE COMPARISON (Visits with Doctor/Chemist, purpose, boxes, cqs) ---");
  const localConverted = await db.visit.count({ where: { boxesPlaced: { gt: 0 } } });
  console.log("Local visits with boxesPlaced > 0:", localConverted);
  const vpsConverted = runVpsSql(`SELECT count(*) FROM "Visit" WHERE "boxesPlaced" > 0;`);
  console.log("VPS visits with boxesPlaced > 0:", vpsConverted);

  process.exit(0);
}

main().catch(console.error);
