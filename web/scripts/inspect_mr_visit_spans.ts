import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  console.log("=== MR ACTIVITY ON OCT 16 (FRIDAY) ON VPS ===");
  const oct16Sql = `
    SELECT json_agg(t) FROM (
      SELECT e."id" as "employeeId",
             e."firstName" || ' ' || e."lastName" as mr,
             count(*) as "visitCount",
             min(v."startedAt")::text as "firstVisit",
             max(v."endedAt")::text as "lastVisit",
             max(v."createdAt")::text as "lastCreatedAt"
      FROM "Visit" v
      JOIN "Employee" e ON v."employeeId" = e."id"
      WHERE v."createdAt" >= '2026-10-16 00:00:00' AND v."createdAt" <= '2026-10-16 23:59:59'
      GROUP BY e."id", e."firstName", e."lastName"
      ORDER BY mr
    ) t;
  `;
  const oct16 = JSON.parse(runVpsSql(oct16Sql));
  console.log("Oct 16 (Friday) MR Activity on VPS:");
  for (const row of oct16) {
    console.log(`  ${row.mr.padEnd(25)} | visits: ${String(row.visitCount).padEnd(2)} | first: ${row.firstVisit} | last: ${row.lastVisit}`);
  }

  console.log("\n=== MR ACTIVITY ON OCT 19 (TODAY) ON VPS ===");
  const oct19Sql = `
    SELECT json_agg(t) FROM (
      SELECT e."id" as "employeeId",
             e."firstName" || ' ' || e."lastName" as mr,
             count(*) as "visitCount",
             min(v."startedAt")::text as "firstVisit",
             max(v."endedAt")::text as "lastVisit",
             max(v."createdAt")::text as "lastCreatedAt"
      FROM "Visit" v
      JOIN "Employee" e ON v."employeeId" = e."id"
      WHERE v."createdAt" >= '2026-10-19 00:00:00' AND v."createdAt" <= '2026-10-19 23:59:59'
      GROUP BY e."id", e."firstName", e."lastName"
      ORDER BY mr
    ) t;
  `;
  const oct19 = JSON.parse(runVpsSql(oct19Sql));
  console.log("Oct 19 (Today) MR Activity on VPS:");
  for (const row of oct19) {
    console.log(`  ${row.mr.padEnd(25)} | visits: ${String(row.visitCount).padEnd(2)} | first: ${row.firstVisit} | last: ${row.lastVisit}`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
