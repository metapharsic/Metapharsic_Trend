import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  console.log("=== MR BREAKDOWN: LOCAL (OCT 16 - OCT 20) ===");
  const localVisits = await db.visit.findMany({
    where: { createdAt: { gte: new Date("2026-10-16T00:00:00Z") } },
    include: { employee: true },
    orderBy: { createdAt: "asc" }
  });

  const localGrid: Record<string, Record<string, number>> = {};
  for (const v of localVisits) {
    const day = v.createdAt.toISOString().slice(0, 10);
    const mr = `${v.employee.firstName} ${v.employee.lastName}`;
    if (!localGrid[day]) localGrid[day] = {};
    localGrid[day][mr] = (localGrid[day][mr] || 0) + 1;
  }
  console.log("Local visits per day per MR:", JSON.stringify(localGrid, null, 2));

  console.log("\n=== MR BREAKDOWN: VPS (OCT 16 - OCT 20) ===");
  const vpsSql = `
    SELECT json_agg(t) FROM (
      SELECT substring(v."createdAt"::text from 1 for 10) as day,
             e."firstName" || ' ' || e."lastName" as mr,
             count(*) as count
      FROM "Visit" v
      JOIN "Employee" e ON v."employeeId" = e."id"
      WHERE v."createdAt" >= '2026-10-16'
      GROUP BY day, mr
      ORDER BY day, mr
    ) t;
  `;
  const vpsRes = JSON.parse(runVpsSql(vpsSql));
  const vpsGrid: Record<string, Record<string, number>> = {};
  for (const row of vpsRes) {
    if (!vpsGrid[row.day]) vpsGrid[row.day] = {};
    vpsGrid[row.day][row.mr] = Number(row.count);
  }
  console.log("VPS visits per day per MR:", JSON.stringify(vpsGrid, null, 2));
}

main().then(() => process.exit(0)).catch(console.error);
